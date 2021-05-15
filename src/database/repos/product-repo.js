const { Product } = require('../models');
const { raw } = require('objection');
const { subDays } = require('date-fns');

class ProductRepo {
    /**
     * eligible products are products that have no reviews and where
     * the last import is older then 7 days
     * @param {{limit: number}} options
     * @returns {Array<Product>}
     */
    async fetchEligibleForReviewImport({ limit = 50 } = {}) {
        const products = await Product.query()
            .leftJoin('product_review_imports as pri', 'pri.id', function () {
                // only join the last queued import
                this.select('prii.id')
                    .from('product_review_imports as prii')
                    .where('prii.product_asin', '=', raw('products.asin'))
                    .orderBy('prii.queued_at', 'desc')
                    .limit(1)
            })
            .whereNotExists(Product.relatedQuery('reviews'))
            .where(function () {
                this.whereNull('pri.id')
                    .orWhere('pri.queued_at', '<', subDays(new Date(), 7))
            })
            .limit(limit);

        return products;
    }
}

module.exports = {
    ProductRepo,
};
