/**
 * SortedSet at spm:connections : timestamp of last use -> connection config hash
 * SortedSet at spm:connections:${connection_config_hash} : timestamp of last use -> listener identifier
 * String at spm:listeners:${listener_identifier} : JSON of SocksListenOptions
 */
class Storage {
    constructor(redis, {listenerExpiry = 10} = {}) {
        this.listenerExpiry = listenerExpiry;
        this.redis = redis;
    }

    /**
     * @param {string} connectionConfigHash
     * @param {string} listenerIdentifier
     * @param {import("./server/server").SocksListenOptions} socksListenOptions
     */
    async storeConnection(connectionConfigHash, listenerIdentifier, socksListenOptions) {
        // store listener options
        await this.redis.set(
            this.key(`listeners:${listenerIdentifier}`),
            JSON.stringify(socksListenOptions),
            'EX',
            this.listenerExpiry
        );

        // assign listener to connection
        await this.redis.zadd(
            this.key(`connections:${connectionConfigHash}`),
            'NX',
            Date.now(),
            listenerIdentifier
        );

        // store connection
        await this.redis.zadd(
            this.key(`connections`),
            'NX',
            Date.now(),
            connectionConfigHash
        );
    }

    /**
     * @param {string} listenerIdentifier
     */
    async refreshListener(listenerIdentifier) {
        await this.redis.expire(
            this.key(`listeners:${listenerIdentifier}`),
            this.listenerExpiry
        );
    }

    async removeListener(listenerIdentifier) {
        await this.redis.del(
            this.key(`listeners:${listenerIdentifier}`)
        );
    }

    /**
     * @returns {{listen: import("./server/server").SocksListenOptions, connectionConfigHash: string}}
     */
    async getLRUConnection() {
        // todo implement
    }

    /**
     * @param {string} connectionConfigHash
     */
    async penalizeConnection(connectionConfigHash) {
        // todo implement
    }

    /**
     * @param {string} key
     * @returns {string}
     */
    key(key) {
        return `spm:${key}`;
    }
}

module.exports = {
    Storage,
};
