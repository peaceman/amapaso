const config = require('config');
const log = require('../../log');
const Redis = require('ioredis');
const crypto = require('crypto');
const { openSshConnection } = require('./ssh');
const { openSocksServer } = require('./socks');
const { Client } = require('ssh2');
const ssh2 = require('ssh2');
const socks = require('socksv5');
const { Storage } = require('../storage');
const { tap } = require('lodash');

/**
 * @typedef {Object} SocksProxyManagerServerOptions
 * @property {SocksOptions} socks
 * @property {SshOptions} ssh
 */

/**
 * @typedef {Object} SocksOptions
 * @property {SocksListenOptions} listen
 * @property {SocksAuthOptions} auth
 */

/**
 * @typedef {Object} SocksListenOptions
 * @property {string} host
 * @property {number|undefined} port
 */

/**
 * @typedef {Object} SocksAuthOptions
 * @property {string} username
 * @property {string} password
 */

/**
 * @typedef {Object} SshOptions
 * @property {Array<SshConnectionConfig>} connections
 * @property {SshConnectionConfig} default
 */

/**
 * @typedef {Object} SshConnectionConfig
 * @property {string} host
 * @property {number} port
 * @property {string} username
 * @property {string|undefined} agent
 * @property {string|Buffer|undefined} privateKey
 * @property {string|undefined} passphrase
 */

/**
 * @typedef {Object} SshConnectionInfo
 * @property {string} hash
 * @property {SshConnectionConfig} config
 * @property {ssh2.Client|undefined} sshConnection
 * @property {socks.Server|undefined} socksServer
 * @property {Promise<any>} closingPromise
 */

class SocksProxyManagerServer {
    /**
     * @param {SocksProxyManagerServerOptions} options
     * @param {Storage} storage
     */
    constructor(options, storage) {
        this.options = options;
        this.storage = storage;

        /** @type {Map<string, SshConnectionInfo>} */
        this.connections = new Map();
        this.stopping = false;
    }

    async start({ watch = true } = {}) {
        await this.establishConnections();

        if (watch) {
            this.watchConnections();
        }
    }

    /**
     * @private
     */
    async establishConnections() {
        const connectionInfoList = buildConnectionInfoList(this.options.ssh.connections);
        const connectionPromises = connectionInfoList
            .map(ci => tap(ci, ci => this.connections.set(ci.hash, ci)))
            .map(ci => this.tryEstablishConnection(ci));

        await Promise.allSettled([
            ...connectionPromises,
        ]);
    }

    /**
     * @private
     */
    async watchConnections() {
        log.info('Start watching connections');

        while (!this.stopping) {
            await this.reopenClosedConnection();
        }

        log.info('Stop watching connections');
    }

    /**
     * @private
     */
    async reopenClosedConnection() {
        const closedConnection = await this.waitForClosedConnection();

        if (!this.stopping) {
            await this.tryEstablishConnection(closedConnection, {reconnectDelay: 10});
        }
    }

    /**
     * @private
     */
    async waitForClosedConnection() {
        const promises = [...this.connections.values()]
            .map(ci => ci.closingPromise.then(() => ci));

        const closedConnection = await Promise.race(promises);
        log.info('Detected closed connection', {config: closedConnection.config});

        await cleanupConnectionResources(closedConnection);

        return closedConnection;
    }

    async stop() {
        this.stopping = true;

        await Promise.allSettled([...this.connections.values()]
            .map(ci => {
                return cleanupConnectionResources(ci)
                    .then(() => ci.closingPromise);
            }));
    }

    /**
     * @param {SshConnectionInfo} connectionInfo
     */
    tryEstablishConnection(connectionInfo, { reconnectDelay = 0} = {}) {
        // catch errors that occur during the connection establishment and use that
        // promise as initial closing promise for the connection, so that it can be
        // reopened automatically like for example if an ssh connection error occurs
        return connectionInfo.closingPromise = this.establishConnection(connectionInfo)
            .catch(error => {
                log.warn('Error during connection establishment', {
                    config: connectionInfo.config,
                    err: error,
                });

                if (reconnectDelay > 0) {
                    log.info(`Wait ${reconnectDelay}s until connection retry`, {
                        config: connectionInfo.config,
                    });

                    return new Promise(resolve => setTimeout(resolve, reconnectDelay * 1000));
                }
            });
    }

    /**
     * @param {SshConnectionInfo} connectionInfo
     */
    async establishConnection(connectionInfo) {
        log.info('Establishing connection', {config: connectionInfo.config});
        const sshConnection = (connectionInfo.sshConnection = await openSshConnection(
            {
                ...this.options.ssh.default,
                ...connectionInfo.config,
            }
        ));

        const socksServer = (connectionInfo.socksServer = await openSocksServer(
            this.options.socks.listen.host,
            this.options.socks.auth
        ));

        setupSocksSshForward(socksServer, sshConnection);

        const listenerIdentifier = await genRandomString(8);
        await this.storage.storeConnection(
            connectionInfo.hash,
            listenerIdentifier,
            {
                ...this.options.socks.listen,
                port: socksServer.address().port,
            }
        );

        const refreshListenerInterval = this.setupRefreshListener(listenerIdentifier);

        const closingPromise = new Promise((resolve, reject) => {
            // disconnect the ssh connection and socks listener on errors
            sshConnection.on('error', error => {
                log.warn('SSH connection error', {
                    config: connectionInfo.config,
                    error,
                });

                resolve();
            });

            sshConnection.on('close', () => {
                log.info('SSH connection closed', {
                    config: connectionInfo.config,
                });

                delete connectionInfo.sshConnection;

                resolve();
            });

            socksServer.on('close', () => {
                log.info('Socks server closed', {
                    config: connectionInfo.config,
                });

                delete connectionInfo.socksServer;

                this.storage.removeListener(listenerIdentifier);
                resolve();
            });
        });

        connectionInfo.closingPromise = closingPromise
            .finally(() => {
                const logCtx = {config: connectionInfo.config};
                log.info('Clearing refresh interval', logCtx);
                clearInterval(refreshListenerInterval)
            });
    }

    /**
     * @param {string} listenerIdentifier
     */
    setupRefreshListener(listenerIdentifier) {
        return setInterval(
            () => {
                log.info('Refresh listener', {listenerIdentifier});
                this.storage.refreshListener(listenerIdentifier)
                    .catch(e => {
                        log.warn(
                            'Failed to refresh listen options ttl',
                            {listenerIdentifier, error: e}
                        );
                    });
            },
            9 * 1000
        );
    }
}

/**
 * @param {Array<SshConnectionConfig>} connections
 * @return {Array<SshConnectionInfo>}
 */
function buildConnectionInfoList(connections) {
    return connections
        .map(c => {
            return {
                hash: crypto.createHash('md5')
                    .update(JSON.stringify(c))
                    .digest('hex'),
                config: c,
                closingPromise: undefined,
            };
        });
}

async function genRandomString(size) {
    const randomBuf = await new Promise((resolve, reject) => {
        crypto.randomBytes(size, (err, buf) => {
            if (err) {
                return reject(err);
            }

            resolve(buf);
        });
    });

    return randomBuf.toString('hex').slice(0, size);
}

/**
 * @param {socks.Server} socksServer
 * @param {Client} sshConnection
 */
function setupSocksSshForward(socksServer, sshConnection) {
    socksServer.on('connection', (info, accept, deny) => {
        log.debug('Socks connection request', {info});
        sshConnection.forwardOut(
            info.srcAddr,
            info.srcPort,
            info.dstAddr,
            info.dstPort,
            (err, stream) => {
                if (err) {
                    // maybe, maybe not
                    sshConnection.end();
                    return deny();
                }

                const clientSocket = accept(true);
                clientSocket.on('error', e => {
                    log.debug('ClientSocket error', {
                        err: e,
                    });

                    clientSocket.destroy();
                });

                if (clientSocket) {
                    socksRecordSockets(socksServer, clientSocket);

                    stream.pipe(clientSocket).pipe(stream);
                } else {
                    deny();
                }
            }
        );
    });
}

/**
* @param {SshConnectionInfo} connectionInfo
*/
async function cleanupConnectionResources(connectionInfo) {
   const logCtx = {config: connectionInfo.config};

   const closePromises = [
       connectionInfo.socksServer
        ? new Promise(resolve => connectionInfo.socksServer.once('close', () => resolve()))
        : Promise.resolve(),
        connectionInfo.sshConnection
        ? new Promise(resolve => connectionInfo.sshConnection.once('close', () => resolve()))
        : Promise.resolve(),
   ];

   if (connectionInfo.socksServer) {
       log.info('Closing socks server', logCtx);
       socksStop(connectionInfo.socksServer);
       delete connectionInfo.socksServer;
   }

   if (connectionInfo.sshConnection) {
       log.info('Closing ssh connection', logCtx);
       connectionInfo.sshConnection.end();
       delete connectionInfo.sshConnection;
   }

   await Promise.allSettled(closePromises);
}

const OPEN_SOCKETS = Symbol('open-sockets');

function socksRecordSockets(socksServer, clientSocket) {
    if (!(OPEN_SOCKETS in socksServer)) {
        socksServer[OPEN_SOCKETS] = new Set();
    }

    socksServer[OPEN_SOCKETS].add(clientSocket);

    clientSocket.once(
        'close',
        () => socksServer[OPEN_SOCKETS].delete(clientSocket)
    );
}

function socksStop(socksServer) {
    for (const s of (socksServer[OPEN_SOCKETS]?.values() ?? [])) {
        s.destroy();
    }

    socksServer.close();
}

module.exports = {
    SocksProxyManagerServer,
};
