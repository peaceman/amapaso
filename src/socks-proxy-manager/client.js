const log = require('../log');
const { SocksProxyAgent } = require('socks-proxy-agent');

const CONNECTION_CONFIG_HASH = Symbol('listener identifier');

/**
 * @typedef {Object} SocksProxyManagerClientOptions
 * @property {import('./server/server').SocksAuthOptions} auth
 */
class SocksProxyManagerClient {
    /**
     * @param {import('./storage').Storage} storage
     */
    constructor(options, storage) {
        /** @type {SocksProxyManagerClientOptions} */
        this.options = options;
        /** @type {import('./storage').Storage} */
        this.storage = storage;
    }

    async getNextHttpAgents() {
        const socksConnection = await this.storage.getLRUConnection();
        if (!socksConnection) {
            log.warn("Didn't get a socks connection from storage");
            return;
        }

        const agent = new SocksProxyAgent({
            ...socksConnection.listen,
            userId: this.options.auth.username,
            password: this.options.auth.password,
        });

        return {
            httpAgent: agent,
            httpsAgent: agent,
            [CONNECTION_CONFIG_HASH]: socksConnection.connectionConfigHash,
        };
    }

    async reportBlockedRequest(agents) {
        const connectionConfigHash = agents[CONNECTION_CONFIG_HASH];
        if (!connectionConfigHash) {
            log.debug("Couldn't extract connection config hash from given agents");
            return;
        }

        await this.storage.penalizeConnection(connectionConfigHash);
    }
}

module.exports = {
    SocksProxyManagerClient,
};
