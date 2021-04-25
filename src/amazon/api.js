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
                reject(error);
            } else {
                resolve(JSON.parse(JSON.stringify(data)));
            }
        })
    });
}

module.exports = {
    ApiClient,
};
