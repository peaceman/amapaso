class Storage {
    constructor(redis, {listenerExpiry = 10} = {}) {
        this.listenerExpiry = listenerExpiry;
        this.redis = redis;
    }

    /**
     * @param {string} connectionConfigHash
     * @param {string} listenerIdentifier
     * @param {import("./server").SocksListenOptions} socksListenOptions
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
