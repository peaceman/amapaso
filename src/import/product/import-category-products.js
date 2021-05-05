const log = require('../../log');
const { ApiClient } = require('../../amazon/api');
const { Product, CategoryProductImport } = require('../../database/models');

/**
 * @typedef {object} ImportCategoryProductsRequest
 * @property {string} categoryId
 * @property {string} categoryProductImportId
 */

/**
 * @typedef {function(ApiClient, string): AsyncGenerator<object, void, void>} SearchCategoryProducts
 */

/**
 * @property {ApiClient} amaApiClient
 * @property {SearchCategoryProducts} searchCategoryProducts
 */
class ImportCategoryProducts {
    /*
     * @param {ApiClient} amaApiClient
     * @param {SearchCategoryProducts} searchCategoryProducts
     */
    constructor(
        amaApiClient,
        searchCategoryProducts
    ) {
        this.amaApiClient = amaApiClient;
        this.searchCategoryProducts = searchCategoryProducts;
    }

    /**
     * @param {ImportCategoryProductsRequest} request
     */
    async execute(request) {
        log.info('Start importing category products', {...request});

        const productImport = await CategoryProductImport.query()
            .findById(request.categoryProductImportId)
            .throwIfNotFound();

        await productImport.markAsStarted();

        const gen = this.searchCategoryProducts(this.amaApiClient, request.categoryId);
        for await (const product of gen) {
            await this.tryStoreProduct(product);
        }

        await productImport.markAsStopped();

        log.info('Finished importing categery products', {...request});
    }

    async tryStoreProduct(product) {
        try {
            await this.storeProduct(product);
        } catch (e) {
            log.warn('Failed to store product', {
                asin: product.ASIN,
                error: e,
            });
        }
    }

    async storeProduct(product) {
        const productData = convertToProductData(product);

        await Product.transaction(async trx => {
            const existingProduct = await Product.query(trx)
                .forUpdate()
                .where({asin: productData.asin})
                .first();

            await Product.query(trx)
                .innerJoin('product_categories')
                .where({asin: productData.asin})
                .forUpdate();

            if (existingProduct) {
                log.info('Updating existing product', {asin: productData.asin});

                // update product
                await existingProduct.$query(trx)
                    .patch(productData);

                // update category relations
                await existingProduct.$relatedQuery('categories', trx)
                    .unrelate();

                await existingProduct.$relatedQuery('categories', trx)
                    .relate(productData.categories.map(({id}) => id));
            } else {
                log.info('Storing new product', {asin: productData.asin});

                await Product.query(trx)
                    .insertGraph(productData, {relate: true});
            }
        });
    }
}

function convertToProductData(product) {
    const categoryIds = (product.BrowseNodeInfo?.BrowseNodes || [])
        .map(n => n.Id);

    return {
        asin: product.ASIN,
        parentAsin: product.ParentASIN,
        data: product,
        categories: categoryIds.map(id => ({id})),
    };
}

module.exports = {
    ImportCategoryProducts
};
