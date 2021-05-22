const { QueueImportCategoryProducts } = require('./queue-import-category-products');
const { categoryRepo, productRepo } = require('../../database/repos');
const { limiter } = require('../../amazon/api/rate-limit');
const { apiClient } = require('../../amazon/api');
const { queue } = require('../../queueing/queue');
const { ImportCategoryProducts } = require('./import-category-products');
const { searchCategoryProducts } = require('../../amazon/category-product-import');
const { QueueImportProductReviews } = require('./queue-import-product-reviews');
const { ImportProductReviews } = require('./import-product-reviews');
const { ProxyAwareProductReviewFetcher } = require('../../amazon/product-review-fetcher');
const { SocksProxyManagerClient } = require('../../socks-proxy-manager/client');
const config = require('config');
const { Storage } = require('../../socks-proxy-manager/storage');
const Redis = require('ioredis');
const { default: Bottleneck } = require('bottleneck');
const { curly } = require('node-libcurl');
const BrowserHeadersGenerator = require('browser-headers-generator');
const log = require('../../log');

const queueImportCategoryProducts = new QueueImportCategoryProducts(
    categoryRepo,
    limiter,
    queue
);

const importCategoryProducts = new ImportCategoryProducts(
    apiClient,
    searchCategoryProducts
);

const queueImportProductReviews = new QueueImportProductReviews(
    productRepo,
    queue
);

const browserHeaderProvider = function () {
    const generator = new BrowserHeadersGenerator();
    let initPromise;

    return {
        get: async () => {
            if (!initPromise) {
                initPromise = new Promise(resolve => {
                    log.info('Initialize browser headers generator');
                    generator.initialize()
                        .then(() => resolve());
                })
            }

            await initPromise;

            const headers = await generator.getRandomizedHeaders();
            const banned = [
                'Accept-Encoding',
                'Pragma',
                'Cache-Control',
                'Referer',
                'Sec-',
            ];

            return Object.entries(headers)
                .filter(([k, v]) => banned.every(b => !k.includes(b)))
                .filter(([k, v]) => v !== undefined)
                .map(([k, v]) => `${k}: ${v}`);
        },
    };
};

const importProductReviews = new ImportProductReviews(
    new ProxyAwareProductReviewFetcher(
        curly,
        browserHeaderProvider(),
        new SocksProxyManagerClient(
            config.get('socksProxyManager.socks'),
            new Storage(new Redis(config.get('redis.connectionUrl')))
        ),
        new Bottleneck({
            clearDatastore: true,
            minTime: 1000,
            maxConcurrent: 1,
            datastore: 'ioredis',
            id: 'product-review-fetcher',
            clientOptions: config.get('redis.connectionUrl'),
            ...config.get('productReviewFetcher.rateLimiter')
        }),
        config.get('productReviewFetcher.socksGatewayProxy')
    )
);

module.exports = {
    queueImportCategoryProducts,
    importCategoryProducts,
    queueImportProductReviews,
    importProductReviews,
};
