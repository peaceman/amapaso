const EventEmitter = require('events');
const { ApiClient } = require('../../client');
const { TooManyRequestsError } = require('../../errors');

class DailyRateLimitBreachDetector extends EventEmitter {
    constructor(storage, {breachLimit = 10} = {}) {
        super();

        this.storage = storage;
        this.breachLimit = breachLimit;
    }

    /**
     * @param {ApiClient} apiClient
     */
    watchApiClient(apiClient) {
        apiClient.on(ApiClient.EVENTS.REQUEST_FAILED, e => {
            if (e instanceof TooManyRequestsError) {
                this.registerFailedRequest(apiClient, e);
            } else {
                this.registerSucceededRequest(apiClient);
            }
        });

        apiClient.on(ApiClient.EVENTS.REQUEST_SUCEEDED, () => {
            this.registerSucceededRequest(apiClient);
        });
    }

    /**
     * @param {ApiClient} apiClient
     * @param {TooManyRequestsError} e
     * @returns
     */
    async registerFailedRequest(apiClient, e) {
        const configHash = apiClient.getConfigHash();
        await this.storage.addFailedRequest(configHash, this.breachLimit);

        const failedRequestCount = await this.storage.getFailedRequestCount(configHash);
        if (failedRequestCount < this.breachLimit) {
            return;
        }

        this.emit(DailyRateLimitBreachDetector.EVENTS.RATE_LIMIT_BREACHED, apiClient);
    }

    /**
     * @param {ApiClient} apiClient
     */
    async registerSucceededRequest(apiClient) {
        const configHash = apiClient.getConfigHash();
        await this.storage.addSucceededRequest(configHash, this.breachLimit);
    }
}

DailyRateLimitBreachDetector.EVENTS = {
    RATE_LIMIT_BREACHED: Symbol('rate limit breached'),
};

module.exports = {
    DailyRateLimitBreachDetector,
};
