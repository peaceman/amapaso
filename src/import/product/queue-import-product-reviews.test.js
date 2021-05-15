const { QueueImportProductReviews } = require('./queue-import-product-reviews');

describe('queue import product reviews', () => {
    let productRepo, queue;

    beforeEach(async () => {
        productRepo = setupProductRepo();
        queue = setupQueue();
    })

    it('queues product review imports', async () => {
        const product = setupProduct();
        const productReviewImport = {id: 23};

        productRepo.fetchEligibleForReviewImport
            .mockReturnValueOnce([
                product
            ]);

        product.createQueuedReviewImport
            .mockReturnValueOnce(productReviewImport);

        const importer = new QueueImportProductReviews(productRepo, queue);
        await importer.execute();

        expect(productRepo.fetchEligibleForReviewImport)
            .toBeCalled();

        expect(product.createQueuedReviewImport)
            .toBeCalled();

        expect(queue.add)
            .toBeCalledWith('import-product-reviews', {
                productAsin: product.asin,
                productReviewImportId: productReviewImport.id,
            });
    });

    function setupProductRepo() {
        return {
            fetchEligibleForReviewImport: jest.fn(),
        };
    }

    function setupProduct() {
        return {
            createQueuedReviewImport: jest.fn(),
        };
    }

    function setupQueue() {
        return {
            add: jest.fn(),
        };
    }
});
