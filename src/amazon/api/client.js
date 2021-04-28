const EventEmitter = require('events');
const pRetry = require('p-retry');
const crypto = require('crypto');
const config = require('config');
const ProductAdvertisingAPIv1 = require('paapi5-nodejs-sdk');
const log = require('../../log');
const { TooManyRequestsError } = require('./errors');

class ApiClient extends EventEmitter {
    constructor(config, limiter) {
        super();
        this.config = config;
        this.client = new ProductAdvertisingAPIv1.DefaultApi(createClientFromConfig(config));
        this.limiter = limiter;
    }

    getBrowseNodesLimit() {
        return 10;
    }

    async getBrowseNodes(nodeIds) {
        if (!nodeIds.length) return;

        const request = new ProductAdvertisingAPIv1.GetBrowseNodesRequest();
        request['BrowseNodeIds'] = nodeIds;
        request['Resources'] = ['BrowseNodes.Ancestor', 'BrowseNodes.Children'];

        this.applyCommonParams(request);

        const response = await this.execRequest(
            'getBrowseNodes',
            request
        );

        return response?.BrowseNodesResult?.BrowseNodes ?? [];
    }

    applyCommonParams(request) {
        request['PartnerTag'] = this.config.get('partnerTag');
        request['PartnerType'] = this.config.get('partnerType');
    }

    execRequest(requestMethod, responseType, request) {
        const scheduleFn = async () => {
            try {
                await promiseRequest(
                    this.client,
                    requestMethod,
                    responseType,
                    request
                );

                this.emit(ApiClient.EVENTS.REQUEST_SUCEEDED);
            } catch (e) {
                this.emit(ApiClient.EVENTS.REQUEST_FAILED, e);

                throw e;
            }
        };

        const retryFn = () => this.limiter.schedule(scheduleFn);

        return pRetry(retryFn);
    }

    getConfigHash() {
        return crypto
            .createHash('md5')
            .update(JSON.stringify(config.util.toObject(this.config)))
            .digest('hex');
    }
}

ApiClient.EVENTS = {
    REQUEST_FAILED: Symbol('request failed'),
    REQUEST_SUCEEDED: Symbol('request succeeded'),
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

module.exports = {
    ApiClient,
};
