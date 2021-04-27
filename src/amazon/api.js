const EventEmitter = require('events');
const ProductAdvertisingAPIv1 = require('paapi5-nodejs-sdk');
const pRetry = require('p-retry');
const log = require('../log');

const applyCommonParams = Symbol('applyCommonParams');
const execRequest = Symbol('execRequest');

function ApiClient(config, limiter) {
    this.config = config;
    this.client = new ProductAdvertisingAPIv1.DefaultApi(createClientFromConfig(config));
    this.limiter = limiter;
}

ApiClient.EVENTS = {
    REQUEST_FAILED: Symbol('request failed'),
    REQUEST_SUCEEDED: Symbol('request succeeded'),
};

ApiClient.prototype.getBrowseNodesLimit = function () {
    return 10;
};

ApiClient.prototype.getBrowseNodes = async function (nodeIds) {
    if (!nodeIds.length) return;

    const request = new ProductAdvertisingAPIv1.GetBrowseNodesRequest();
    request['BrowseNodeIds'] = nodeIds;
    request['Resources'] = ['BrowseNodes.Ancestor', 'BrowseNodes.Children'];

    this[applyCommonParams](request);

    const response = await this[execRequest](
        'getBrowseNodes',
        request
    );

    return response?.BrowseNodesResult?.BrowseNodes ?? [];
};

ApiClient.prototype[applyCommonParams] = function (request) {
    request['PartnerTag'] = this.config.partnerTag;
    request['PartnerType'] = this.config.partnerType;
};

ApiClient.prototype[execRequest] = function (requestMethod, responseType, request) {
    const scheduleFn = () => promiseRequest(
        this.client,
        requestMethod,
        responseType,
        request
    );

    const retryFn = () => this.limiter.schedule(scheduleFn);

    return pRetry(retryFn);
};

function createClientFromConfig(config) {
    const client = new ProductAdvertisingAPIv1.ApiClient();

    client.accessKey = config.accessKey;
    client.secretKey = config.secretKey;
    client.host = config.host;
    client.region = config.region;

    return client;
}

function promiseRequest(client, requestMethod, request) {
    return new Promise((resolve, reject) => {
        client[requestMethod](request, (error, data, response) => {
            if (error) {
                log.error('PAAPI Error', {error, data, response});
                reject(convertPAAPIError(error));
            } else {
                // get rid of the annoying paapi sdk data types
                resolve(JSON.parse(JSON.stringify(data)));
            }
        })
    });
}

function convertPAAPIError(error) {
    if (error.status === 429) {
        return new TooManyRequestsError(error);
    } else {
        return error;
    }
}

class TooManyRequestsError {
    constructor(previous) {
        this.previous = previous;
    }
}

class DailyRateLimitBreachDetector extends EventEmitter {
    constructor(storage, {breachLimit = 10} = {}) {
        super();

        this.storage = storage;
        this.breachLimit = breachLimit;
    }

    /**
     * @param {EventEmitter} apiClient
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

    async registerFailedRequest(apiClient, e) {
        const configHash = apiClient.getConfigHash();
        await this.storage.addFailedRequest(configHash, this.breachLimit);

        if (await this.storage.getFailedRequestCount(configHash) < this.breachLimit) {
            return;
        }

        this.emit(DailyRateLimitBreachDetector.EVENTS.RATE_LIMIT_BREACHED, apiClient);
    }

    async registerSucceededRequest(apiClient) {
        const configHash = apiClient.getConfigHash();
        await this.storage.addSucceededRequest(configHash, this.breachLimit);
    }
}

DailyRateLimitBreachDetector.EVENTS = {
    RATE_LIMIT_BREACHED: Symbol('rate limit breached'),
};

class DailyRateLimitBreachStorage {
    constructor(redis) {
        this.redis = redis;
    }

    async addFailedRequest(identifier, limit) {
        await this.addRequest(identifier, limit, false);
    }

    async addSucceededRequest(identifier, limit) {
        await this.addRequest(identifier, limit, true);
    }

    async addRequest(identifier, limit, value) {
        const listName = this.getListName(identifier);
        await this.redis.lpush(listName, value);
        await this.redis.ltrim(listName, limit - 1);
    }

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

    getListName(identifier)  {
        return `rlb-${identifier}`;
    }
}

module.exports = {
    ApiClient,
    TooManyRequestsError,
    DailyRateLimitBreachDetector,
    DailyRateLimitBreachStorage,
};
