const log = require('../../log');
const { ProductRepo } = require('../../database/repos/product-repo');
const { Queue } = require('bullmq');
const { JOBS } = require('../../queueing/meta');

class QueueImportProductReviews {
    /**
     * @param {ProductRepo} productRepo
     * @param {Queue} queue
     */
    constructor(productRepo, queue) {
        /** @type {ProductRepo} */
        this.productRepo = productRepo;
        /** @type {Queue} */
        this.queue = queue;
    }

    async execute() {
        const products = await this.productRepo.fetchEligibleForReviewImport();

        if (products.length === 0) {
            log.info('Found no eligible products for review imports');
            return;
        }

        log.info('Found eligible products for review import', {count: products.length});

        for (const product of products) {
            const reviewImport = await product.createQueuedReviewImport();
            /** @type {import('./import-product-reviews').ImportProductReviewsRequest} */
            const jobData = {productAsin: product.asin, productReviewImportId: reviewImport.id};

            await this.queue.add(JOBS.IMPORT_PRODUCT_REVIEWS, jobData);
            log.info('Queued import-product-reviews', jobData);
        }
    }
}

module.exports = {
    QueueImportProductReviews,
};
