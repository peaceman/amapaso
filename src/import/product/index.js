const { QueueImportCategoryProducts } = require('./queue-import-category-products');
const { categoryRepo } = require('../../database/repos');
const { limiter } = require('../../amazon/api/rate-limit');
const { apiClient } = require('../../amazon/api');
const { queue } = require('../../queueing/queue');
const { ImportCategoryProducts } = require('./import-category-products');
const { searchCategoryProducts } = require('../../amazon/category-product-import');

const queueImportCategoryProducts = new QueueImportCategoryProducts(
    categoryRepo,
    limiter,
    queue
);

const importCategoryProducts = new ImportCategoryProducts(
    apiClient,
    searchCategoryProducts
);

module.exports = {
    queueImportCategoryProducts,
    importCategoryProducts,
};
