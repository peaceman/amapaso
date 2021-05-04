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

    /**
     * @param {string} categoryId
     * @param {number} page
     */
    async searchCategoryItems(categoryId, page) {
        const request = new ProductAdvertisingAPIv1.SearchItemsRequest();
        request['BrowseNodeId'] = categoryId;
        request['ItemPage'] = page;
        request['SortBy'] = 'AvgCustomerReviews';
        request['Resources'] = [
            'BrowseNodeInfo.BrowseNodes',
            'CustomerReviews.Count',
            'CustomerReviews.StarRating',
            'Images.Primary.Small',
            'Images.Primary.Medium',
            'Images.Primary.Large',
            'Images.Variants.Small',
            'Images.Variants.Medium',
            'Images.Variants.Large',
            'ItemInfo.ByLineInfo',
            'ItemInfo.ContentInfo',
            'ItemInfo.ContentRating',
            'ItemInfo.Classifications',
            'ItemInfo.ExternalIds',
            'ItemInfo.Features',
            'ItemInfo.ManufactureInfo',
            'ItemInfo.ProductInfo',
            'ItemInfo.TechnicalInfo',
            'ItemInfo.Title',
            'ItemInfo.TradeInInfo',
            'Offers.Listings.Availability.MaxOrderQuantity',
            'Offers.Listings.Availability.Message',
            'Offers.Listings.Availability.MinOrderQuantity',
            'Offers.Listings.Availability.Type',
            'Offers.Listings.Condition',
            'Offers.Listings.Condition.ConditionNote',
            'Offers.Listings.Condition.SubCondition',
            'Offers.Listings.DeliveryInfo.IsAmazonFulfilled',
            'Offers.Listings.DeliveryInfo.IsFreeShippingEligible',
            'Offers.Listings.DeliveryInfo.IsPrimeEligible',
            'Offers.Listings.DeliveryInfo.ShippingCharges',
            'Offers.Listings.IsBuyBoxWinner',
            'Offers.Listings.LoyaltyPoints.Points',
            'Offers.Listings.MerchantInfo',
            'Offers.Listings.Price',
            'Offers.Listings.ProgramEligibility.IsPrimeExclusive',
            'Offers.Listings.ProgramEligibility.IsPrimePantry',
            'Offers.Listings.Promotions',
            'Offers.Listings.SavingBasis',
            'Offers.Summaries.HighestPrice',
            'Offers.Summaries.LowestPrice',
            'Offers.Summaries.OfferCount',
            'ParentASIN'
        ];

        this.applyCommonParams(request);

        const response = await this.execRequest(
            'searchItems',
            request
        );

        return response?.SearchResult?.Items ?? [];
    }

    applyCommonParams(request) {
        request['PartnerTag'] = this.config.get('partnerTag');
        request['PartnerType'] = this.config.get('partnerType');
    }

    execRequest(requestMethod, request) {
        const scheduleFn = async () => {
            try {
                const response = await promiseRequest(
                    this.client,
                    requestMethod,
                    request
                );

                this.emit(ApiClient.EVENTS.REQUEST_SUCEEDED);

                return response;
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
