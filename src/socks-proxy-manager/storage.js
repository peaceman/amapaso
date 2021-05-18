const log = require("../log");

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
     * @returns {{listen: import("./server/server").SocksListenOptions, connectionConfigHash: string}|undefined}
     */
    async getLRUConnection() {
        try {
            while (true) {
                const [connectionConfigHash] = await this.redis.zrange(this.key('connections'), 0, 1);
                if (connectionConfigHash === undefined) return;

                // update score of the connection
                await this.updateScore(this.key('connections'), connectionConfigHash);

                const [listenerIdentifier] = await this.redis.zrange(
                    this.key(`connections:${connectionConfigHash}`),
                    0, 1
                );

                // remove connection from sorted set if it is empty
                if (listenerIdentifier === undefined) {
                    log.info('Remove non existent connection', {connectionConfigHash});
                    await this.redis.zrem(
                        this.key('connections'),
                        connectionConfigHash
                    );

                    continue;
                }

                // update score of the listener
                await this.updateScore(this.key(`connections:${connectionConfigHash}`), listenerIdentifier);

                const listenOptionsJson = await this.redis.get(this.key(`listeners:${listenerIdentifier}`));

                // remove listener from sorted set if it does not exist
                if (listenOptionsJson === null) {
                    log.info('Remove non existent listener from connection', {listenerIdentifier, connectionConfigHash});

                    await this.redis.zrem(
                        this.key(`connections:${connectionConfigHash}`),
                        listenerIdentifier
                    );

                    continue;
                }

                log.info('LRU proxy', listenOptionsJson);

                return {
                    listen: JSON.parse(listenOptionsJson),
                    connectionConfigHash,
                };
            }
        } catch (e) {
            log.error('An error occurred during get lru connection', {err: e});
            return undefined;
        }
    }

    /**
     * @private
     * @param {string} key
     * @param {string} item
     * @param {*} options
     */
    async updateScore(key, item, { score = Date.now() } = {}) {
        await this.redis.zadd(
            key,
            'GT',
            score,
            item
        );
    }

    /**
     * @param {string} connectionConfigHash
     */
    async penalizeConnection(connectionConfigHash) {
        await this.redis.zadd(
            this.key('connections'),
            'XX',
            'INCR',
            100 * 1000,
            connectionConfigHash
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
