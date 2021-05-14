const log = require('../../log');
const { ProductReviewFetcher } = require('../../amazon/product-review-fetcher');
const ProductReview = require('../../database/models/ProductReview');
const { raw, UniqueViolationError } = require('objection');
const { formatISO9075 } = require('date-fns');
const ProductReviewImport = require('../../database/models/ProductReviewImport');

/**
 * @typedef {Object} ImportProductReviewsRequest
 * @property {string} productAsin
 * @property {string} productReviewImportId
 */

class ImportProductReviews {
    /**
     * @param {ProductReviewFetcher} productReviewFetcher
     */
    constructor(
        productReviewFetcher
    ) {
        /** @type {ProductReviewFetcher} */
        this.productReviewFetcher = productReviewFetcher;
    }

    /**
     * @param {ImportProductReviewsRequest} request
     */
    async execute(request) {
        log.info('Start importing product reviews', {...request});

        const productReview = await ProductReviewImport.query()
            .findById(request.productReviewImportId);

        await productReview.markAsStarted();

        const reviewGen = this.productReviewFetcher.fetchReviews(request.productAsin);
        for await (const reviewData of reviewGen) {
            await this.tryToCreateReview(request.productAsin, reviewData);
        }

        await productReview.markAsStopped();

        log.info('Finished importing product reviews', {...request});
    }

    /**
     *
     * @param {string} productAsin
     * @param {import('../../amazon/product-review-fetcher').ProductReviewData} reviewData
     */
    async tryToCreateReview(productAsin, reviewData) {
        await ProductReview.transaction(async trx => {
            const exists = await ProductReview.query(trx)
                .select(raw(1))
                .where({id: reviewData.id})
                .first();

            if (exists !== undefined) {
                log.info('Product review already exists', {
                    productAsin,
                    reviewId: reviewData.id,
                });

                return;
            }

            try {
                await ProductReview.query(trx)
                    .insert({
                        ...reviewData,
                        date: formatISO9075(reviewData.date, { representation: 'date' }),
                        productAsin,
                    });
            } catch (e) {
                if (e instanceof UniqueViolationError) {
                    log.warn('Product review already exists, but surpassed the first check', {
                        productAsin,
                        reviewId: reviewData.id,
                    });
                } else {
                    throw e;
                }
            }
        });
    }
}

module.exports = {
    ImportProductReviews,
};
