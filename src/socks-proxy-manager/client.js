const socks = require('socksv5');
const log = require('../log');

const CONNECTION_CONFIG_HASH = Symbol('listener identifier');

class SocksProxyManagerClient {
    /**
     * @param {import('./storage').Storage} storage
     */
    constructor(storage) {
        /** @type {import('./storage').Storage} */
        this.storage = storage;
    }

    async getNextHttpAgents() {
        const socksConnection = await this.storage.getLRUConnection();
        if (!socksConnection) {
            log.warn("Didn't get a socks connection from storage");
            return;
        }

        return {
            httpAgent: new socks.HttpAgent(socksConnection.listen),
            httpsAgent: new socks.HttpsAgent(socksConnection.listen),
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
