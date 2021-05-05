const log = require('../log');
const { ApiClient } = require('../amazon/api');

/**
 * @param {ApiClient} apiClient
 * @param {string} categoryId
 *
 * @returns {AsyncGenerator<object, void, void>}
 */
async function* searchCategoryProducts(apiClient, categoryId) {

}

module.exports = {
    searchCategoryProducts,
};
