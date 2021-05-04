const { QueueImportCategoryProducts } = require('./queue-import-category-products');
const { Category } = require('../../database/models');

describe('queue category products import', () => {
    it(
        'checks if the rate limiter would currently allow a request before queueing stuff',
        async () => {
            const rateLimiter = setupRateLimiter();
            const categoryRepo = setupCategoryRepo();
            const queue = setupQueue();

            rateLimiter.check.mockReturnValue(Promise.resolve(false));

            const queueCategoryProductsImport = new QueueImportCategoryProducts(
                categoryRepo, rateLimiter, queue
            );

            await queueCategoryProductsImport.execute();

            expect(rateLimiter.check).toHaveBeenCalled();
            expect(categoryRepo.fetchEligibleForPeriodicProductsImport).not.toHaveBeenCalled();
        }
    );

    it('queues category products imports', async () => {
        const rateLimiter = setupRateLimiter();
        const categoryRepo = setupCategoryRepo();
        const queue = setupQueue();
        const categoryIds = [23, 5];
        const categories = categoryIds.map(id => Category.fromDatabaseJson({id}));

        rateLimiter.check.mockReturnValue(Promise.resolve(true));
        categoryRepo.fetchEligibleForPeriodicProductsImport
            .mockReturnValue(Promise.resolve(categories));

        const queueCategoryProductsImport = new QueueImportCategoryProducts(
            categoryRepo, rateLimiter, queue
        );

        await queueCategoryProductsImport.execute();
        for (const category of categories) {
            expect(queue.add).toHaveBeenCalledWith('import-category-products', { categoryId: category.id });
            expect(categoryRepo.markQueuedProductsImport).toHaveBeenCalledWith(category);
        }
    });

    function setupRateLimiter() {
        return {
            check: jest.fn(),
        };
    }

    function setupCategoryRepo() {
        return {
            fetchEligibleForPeriodicProductsImport: jest.fn(),
            markQueuedProductsImport: jest.fn(),
        };
    }

    function setupQueue() {
        return {
            add: jest.fn(),
        };
    }
});
