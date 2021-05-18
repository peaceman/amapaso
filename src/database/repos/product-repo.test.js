const { createDatabase, dropDatabase, truncateDatabase } = require('../../test/database');
const { Model } = require('objection');
const { ProductRepo } = require('./product-repo');
const Product = require('../models/Product');
const { subDays } = require('date-fns');

describe('product repo integration tests', () => {
    let db;

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

    describe('fetches eligible products for review import', () => {
        let product, productRepo;

        beforeEach(async () => {
            product = await createProduct();
            productRepo = new ProductRepo();
        });

        it('fetches products without import', async () => {
            const products = await productRepo.fetchEligibleForReviewImport();
            expect(products).toContainEqual(product);
        });

        it('fetches products with stopped import and without reviews', async () => {
            await product.$relatedQuery('reviewImports')
                .insert({
                    queuedAt: subDays(new Date(), 14).toISOString(),
                    startedAt: subDays(new Date(), 14).toISOString(),
                    stoppedAt: subDays(new Date(), 14).toISOString(),
                });

            const products = await productRepo.fetchEligibleForReviewImport();
            expect(products).toContainEqual(product);
        });

        it('doesnt fetch products with stopped import and without reviews where the last import was too recent', async () => {
            await product.$relatedQuery('reviewImports')
                .insert({
                    queuedAt: new Date().toISOString(),
                    startedAt: new Date().toISOString(),
                    stoppedAt: new Date().toISOString(),
                });

            const products = await productRepo.fetchEligibleForReviewImport();
            expect(products).toHaveLength(0);
        });

        it('doesnt fetch more products than the defined limit', async () => {
            await createProduct({ asin: '0123456789' });

            const products = await productRepo.fetchEligibleForReviewImport({ limit: 1 });
            expect(products).toHaveLength(1);
        });

        it('doesnt fetch products with reviews', async () => {
            await product.$relatedQuery('reviews')
                .insert({
                    id: 'foo',
                    name: 'review',
                    title: 'review',
                    content: 'review',
                    points: 3.5,
                    date: '1980-05-23'
                });

                const products = await productRepo.fetchEligibleForReviewImport({ limit: 1 });
                expect(products).toHaveLength(0);
        });

        it('doesnt fetch products with parent asin', async () => {
            const parent = await createProduct({ asin: '0123456789'});
            await product.$query().patch({ parentAsin: parent.asin });

            const products = await productRepo.fetchEligibleForReviewImport({ limit: 1 });
            expect(products).toHaveLength(1);
            expect(products).toContainEqual(parent);
        });

        async function createProduct({ asin = '1234567890' } = {}) {
            return await Product.query()
                .insertAndFetch({
                    asin,
                    data: { magic: true },
                });
        }
    });
});
