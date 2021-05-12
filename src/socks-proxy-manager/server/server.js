const config = require('config');
const log = require('../../log');
const Redis = require('ioredis');
const crypto = require('crypto');
const { openSshConnection } = require('./ssh');
const { openSocksServer } = require('./socks');
const { Client } = require('ssh2');

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
 */


class SocksProxyManagerServer {
    /**
     * @param {SocksProxyManagerServerOptions} options
     * @param {Redis} redis
     */
    constructor(options, redis) {
        this.options = options;
        this.redis = redis;

        this.connectionPromises = new Map();
        this.sshConnections = new Set();
        this.stopping = false;

        this.run();
    }

    async run() {
        const connectionInfoList = buildConnectionInfoList(this.options.ssh.connections);

        while (!this.stopping) {
            const connectionPromises = connectionInfoList.map(ci => this.requestConnection(ci));

            await Promise.race([
                ...connectionPromises,
            ]);
        }
    }

    stop() {
        this.stopping = true;

        for (const connection of this.sshConnections) {
            connection.end();
        }
    }

    /**
     * @param {SshConnectionInfo} connectionInfo
     */
    requestConnection(connectionInfo) {
        if (this.connectionPromises.has(connectionInfo.hash)) {
            return this.connectionPromises.get(connectionInfo.hash);
        }

        const storeConnectionPromise = p => this.connectionPromises.set(connectionInfo.hash, p);
        const clearConnectionPromise = () => this.connectionPromises.delete(connectionInfo.hash);

        const connectionPromise = this.establishConnection(connectionInfo);

        storeConnectionPromise(connectionPromise);

        return connectionPromise
            .finally(() => clearConnectionPromise());
    }

    /**
     * @param {SshConnectionInfo} connectionInfo
     */
    async establishConnection(connectionInfo) {
        let sshConnection;
        try {
            sshConnection = await openSshConnection(connectionInfo.config);
        } catch (e) {
            log.warn('Failed to open ssh connection', {
                connectionInfo,
                error: e,
            });

            // delay further connection attempts
            return new Promise(resolve => setTimeout(resolve, 15 * 1000));
        }

        const socksServer = await openSocksServer(
            this.options.socks.listen.host,
            this.options.socks.auth
        );

        const socksListenOptions = {
            ...this.options.socks.listen,
            port: socksServer.address().port,
        };

        setupSocksSshForward(socksServer, sshConnection);

        const listenerIdentifier = await genRandomString(8);
        try {
            await Promise.all([
                this.storeListenOptions(listenerIdentifier, socksListenOptions),
                this.storeListenerForConnection(listenerIdentifier, connectionInfo.hash),
                this.storeConnection(connectionInfo.hash),
            ]);
        } catch (e) {
            log.error('Failed to store connection information', {
                connectionInfo,
                listenerIdentifier,
                error: e,
            });

            sshConnection.end();
            socksServer.close();

            return Promise.resolve();
        }

        const refreshListenOptionsInterval = this.setupRefreshListenOptions(listenerIdentifier);

        const connectionPromise = new Promise((resolve, reject) => {
            // disconnect the ssh connection and socks listener on errors
            sshConnection.on('error', error => {
                log.warn('SSH connection error', {
                    connectionInfo,
                    error,
                });

                sshConnection.end();
                socksServer.close();
            });

            sshConnection.on('close', () => {
                log.info('SSH connection closed', {
                    connectionInfo,
                });

                socksServer.close();
                this.sshConnections.delete(sshConnection);
                resolve();
            });

            socksServer.on('close', () => {
                log.info('Socks server closed', {
                    socksListenOptions,
                });

                sshConnection.end();
                clearInterval(refreshListenOptionsInterval);
            });
        });

        this.sshConnections.add(sshConnection);
        await connectionPromise;
    }

    /**
     * @param {string} listenerIdentifier
     * @param {SocksListenOptions} socksListenOptions
     */
    async storeListenOptions(listenerIdentifier, socksListenOptions) {
        await this.redis.set(
            `spm:listeners:${listenerIdentifier}`,
            JSON.stringify(socksListenOptions),
            'EX',
            10
        );
    }

    /**
     * @param {string} listenerIdentifier
     * @param {string} connectionConfigHash
     */
    async storeListenerForConnection(listenerIdentifier, connectionConfigHash) {
        const setKey = `spm:connections:${connectionConfigHash}`;

        await this.redis.zadd(setKey, 'NX', Date.now(), listenerIdentifier);
    }

    /**
     * @param {string} connectionConfigHash
     */
    async storeConnection(connectionConfigHash) {
        await this.redis.zadd('spm:connections', 'NX', Date.now(), connectionConfigHash);
    }

    async refreshListenOptionsTtl(listenerIdentifier) {
        await this.redis.expire(`spm:listeners:${listenerIdentifier}`, 10);
    }

    setupRefreshListenOptions(listenerIdentifier) {
        return setInterval(
            () => {
                this.refreshListenOptionsTtl(listenerIdentifier)
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
                if (clientSocket) {
                    stream.pipe(clientSocket).pipe(stream);
                } else {
                    deny();
                }
            }
        );
    });
}

module.exports = {
    SocksProxyManagerServer,
};
