const log = require('../log');
const { ApiClient } = require('../amazon/api');

/**
 * @param {ApiClient} apiClient
 * @param {string} categoryId
 *
 * @returns {AsyncGenerator<object, void, void>}
 */
async function* searchCategoryProducts(apiClient, categoryId) {
    let page = 1;

    while (true) {
        log.info('Fetching category products', {categoryId, page});

        const products = await apiClient.searchCategoryItems(categoryId, page);
        yield* products;

        if (products.length === 0 || page === 10)
            break;

        page++;
    }

    log.info('Finished fetching category products', {categoryId, lastFetchedPage: page});
}

module.exports = {
    searchCategoryProducts,
};
