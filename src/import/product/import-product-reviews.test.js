const { createDatabase, dropDatabase, truncateDatabase } = require('../../test/database');
const { Model } = require('objection');
const { ImportProductReviews } = require('./import-product-reviews');
const { Product } = require('../../database/models');
const ProductReviewImport = require('../../database/models/ProductReviewImport');

describe('import product reviews', () => {
    let db;
    /** @type {Product} */
    let product;
    /** @type {ProductReviewImport} */
    let productReviewImport;

    beforeAll(async () => {
        db = await createDatabase();
        Model.knex(db.knex);
    });

    afterAll(async () => {
        await dropDatabase(db);
    });

    afterEach(async () => {
        await truncateDatabase(db);
    });

    beforeEach(async () => {
        await createProduct();
    });

    const reviewData = [
        {
            id: 'R25AL9PZCHBHO5',
            name: 'Bamf DK',
            title: 'Super 5e Dm screen',
            points: 5.0,
            content: "Ich selbst Leite seit geraumer Zeit eine eigene DND runde im 5e und der cheat sheet ist super und aufjedenfall customizable für jeden dm.\nauch noice. der gr0ße drache der die party oneshotted mit der legendary tailswipe action :3",
            date: new Date(2018, 6, 7),
        },
        {
            id: 'R191XK5W6T08ZC',
            name: 'Gábor Mihály',
            title: 'Schön und vielseitig!',
            points: 5.0,
            content: "Super! Ich liebe es benutzen. Auch für DMs mit Erfahrung kann es eine gute Hilfe leisten. Gutes Wert für den Preis!",
            date: new Date(2018, 3, 20),
        },
        {
            id: 'R3F64PW7QF22MT',
            name: 'Harmen de Velde',
            title: 'Great for quick references',
            points: 4.0,
            content: "All the right information for a homebrew is in the screen",
            date: new Date(2019, 7, 16),
        },
    ];

    it('imports reviews', async () => {
        const productReviewFetcher = setupProductReviewFetcher();

        productReviewFetcher.fetchReviews.mockImplementationOnce(async function* () {
            yield* reviewData;
        });

        const importProductReviews = new ImportProductReviews(productReviewFetcher);
        await importProductReviews.execute({
            productAsin: product.asin,
            productReviewImportId: productReviewImport.id,
        });

        expect(productReviewFetcher.fetchReviews)
            .toBeCalledTimes(1);
        expect(productReviewFetcher.fetchReviews)
            .toBeCalledWith(product.asin);

        for (const rd of reviewData) {
            const review = await product.$relatedQuery('reviews')
                .findOne({id: rd.id});

            expect(review).toBeDefined();
            expect(review).toMatchObject(rd);
        }
    });

    it('doesnt crash with duplicates', async () => {
        const productReviewFetcher = setupProductReviewFetcher();

        productReviewFetcher.fetchReviews.mockImplementation(async function* () {
            yield* reviewData;
        });

        const importProductReviews = new ImportProductReviews(productReviewFetcher);
        await importProductReviews.execute({
            productAsin: product.asin,
            productReviewImportId: productReviewImport.id,
        });

        await importProductReviews.execute({
            productAsin: product.asin,
            productReviewImportId: productReviewImport.id,
        });

        for (const rd of reviewData) {
            const review = await product.$relatedQuery('reviews')
                .findOne({id: rd.id});

            expect(review).toBeDefined();
            expect(review).toMatchObject(rd);
        }
    });

    it('doesnt crash the whole import process if some reviews are invalid or incomplete', async () => {
        const productReviewFetcher = setupProductReviewFetcher();

        productReviewFetcher.fetchReviews.mockImplementation(async function* () {
            yield* [
                {},
                {id: 'foobar'},
                ...reviewData,
            ];
        });

        const importProductReviews = new ImportProductReviews(productReviewFetcher);
        await importProductReviews.execute({
            productAsin: product.asin,
            productReviewImportId: productReviewImport.id,
        });

        for (const rd of reviewData) {
            const review = await product.$relatedQuery('reviews')
                .findOne({id: rd.id});

            expect(review).toBeDefined();
            expect(review).toMatchObject(rd);
        }
    });

    it('will mark the review import as started and stopped', async () => {
        const productReviewFetcher = setupProductReviewFetcher();

        productReviewFetcher.fetchReviews.mockImplementation(async function* () {
            yield* [];
        });

        const importProductReviews = new ImportProductReviews(productReviewFetcher);
        await importProductReviews.execute({
            productAsin: product.asin,
            productReviewImportId: productReviewImport.id,
        });

        productReviewImport = await productReviewImport.$query();
        expect(productReviewImport).toBeDefined();
        expect(productReviewImport.startedAt).not.toBeNull();
        expect(productReviewImport.stoppedAt).not.toBeNull();
    });

    function setupProductReviewFetcher() {
        return {
            fetchReviews: jest.fn(),
        };
    }

    function setupSocksProxyManagerClient() {
        return {
            getNextHttpAgents: jest.fn(),
            reportBlockedRequest: jest.fn(),
        };
    }

    async function createProduct() {
        // create category
        product = await Product.query()
            .insertAndFetch({
                asin: 'abcdefghij',
                data: { magic: true }
            });

        productReviewImport = await product.createQueuedReviewImport();
    }
});
