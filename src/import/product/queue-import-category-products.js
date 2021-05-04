const { Queue } = require('bullmq');
const { CategoryRepo } = require('../../database/repos');
const Bottleneck = require('bottleneck');

const log = require('../../log');

/**
 * @property {CategoryRepo} categoryRepo
 * @property {Bottleneck} amaRateLimiter
 * @property {Queue} queue
 */
class QueueImportCategoryProducts {
    /**
     * @param {CategoryRepo} categoryRepo
     * @param {Bottleneck} amaRateLimiter
     * @param {Queue} queue
     */
    constructor(
        categoryRepo,
        amaRateLimiter,
        queue
    ) {
        this.categoryRepo = categoryRepo;
        this.amaRateLimiter = amaRateLimiter;
        this.queue = queue;
    }

    async execute() {
        if (!(await this.rateLimiterHasCapacity())) {
            return;
        }

        const eligibleCategories = await this.categoryRepo
            .fetchCategoriesEligibleForPeriodicImport();

        if (eligibleCategories.length === 0) {
            log.info('Found no eligible categories for the periodic products import');
            return;
        }

        log.info(
            'Found categories eligible for the periodic import',
            {count: eligibleCategories.length}
        );

        for (const category of eligibleCategories) {
            await this.queue.add('import-category-products', { categoryId: category.id });
            await this.categoryRepo.markQueuedProductsImport(category);
            log.info('Queued import-category-products', { categoryId: category.id });
        }
    }

    async rateLimiterHasCapacity() {
        const rateLimiterHasCapacity = await this.amaRateLimiter.check();
        if (!rateLimiterHasCapacity) {
            log.info(
                'Tried to queue category products imports, but the rate limiter has no free slots'
            );
        }

        return rateLimiterHasCapacity;
    }
}

module.exports = {
    QueueImportCategoryProducts: QueueImportCategoryProducts,
};
