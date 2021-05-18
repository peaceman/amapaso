const log = require('../log');
const { SocksProxyAgent } = require('socks-proxy-agent');

const CONNECTION_CONFIG_HASH = Symbol('listener identifier');

/**
 * @typedef {Object} SocksConnectionInfo
 * @property {import("./server/server").SocksListenOptions} listen
 * @property {import('./server/server').SocksAuthOptions} auth
 */

/**
 * @typedef {Object} SocksProxyManagerClientOptions
 * @property {import('./server/server').SocksAuthOptions} auth
 */
class SocksProxyManagerClient {
    /**
     * @param {SocksProxyManagerClientOptions} options
     * @param {import('./storage').Storage} storage
     */
    constructor(options, storage) {
        /** @type {SocksProxyManagerClientOptions} */
        this.options = options;
        /** @type {import('./storage').Storage} */
        this.storage = storage;
    }

    /**
     * @returns {SocksConnectionInfo}
     */
    async getNextSocksConnectionInfo() {
        log.info('Fetch next socks connection info from storage');
        const socksConnection = await this.storage.getLRUConnection();
        if (!socksConnection) {
            log.warn("Didn't get a socks connection from storage");
            return;
        }

        return {
            listen: socksConnection.listen,
            auth: this.options.auth,
            [CONNECTION_CONFIG_HASH]: socksConnection.connectionConfigHash,
        };
    }

    async reportBlockedRequest(agents) {
        const connectionConfigHash = agents[CONNECTION_CONFIG_HASH];
        if (!connectionConfigHash) {
            log.debug("Couldn't extract connection config hash from given socks connection info");
            return;
        }

        await this.storage.penalizeConnection(connectionConfigHash);
    }
}

module.exports = {
    SocksProxyManagerClient,
};
