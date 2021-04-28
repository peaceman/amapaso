class DailyRateLimitBreachStorage {
    constructor(redis) {
        this.redis = redis;
    }

    /**
     * @param {string} identifier
     * @param {number} limit
     */
    async addFailedRequest(identifier, limit) {
        await this.addRequest(identifier, limit, false);
    }

    /**
     * @param {string} identifier
     * @param {number} limit
     */
    async addSucceededRequest(identifier, limit) {
        await this.addRequest(identifier, limit, true);
    }

    /**
     * @param {string} identifier
     * @param {number} limit
     * @param {boolean} value
     */
    async addRequest(identifier, limit, value) {
        const listName = this.getListName(identifier);
        await this.redis.lpush(listName, value);
        await this.redis.ltrim(listName, 0, limit - 1);
    }

    /**
     * @param {string} identifier
     * @returns {number}
     */
    async getFailedRequestCount(identifier) {
        const values = await this.redis.lrange(this.getListName(identifier), 0, -1);

        // count continuous failed requests
        let counter = 0;
        for (const val of values) {
            if (val === true) {
                break;
            } else {
                counter++;
            }
        }

        return counter;
    }

    /**
     * @param {string} identifier
     * @returns {string}
     */
    getListName(identifier)  {
        return `rlb-${identifier}`;
    }
}

module.exports = {
    DailyRateLimitBreachStorage,
};
