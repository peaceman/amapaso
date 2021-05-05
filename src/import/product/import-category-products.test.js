const fs = require('fs');
const { createDatabase, dropDatabase, truncateDatabase } = require('../../test/database');
const { ImportCategoryProducts } = require('./import-category-products');
const { Category, Product } =  require('../../database/models');
const { Model } = require('objection');
const { categoryRepo } = require('../../database/repos');

describe('import category products', () => {
    let db;

    beforeAll(async () => {
        db = await createDatabase();
        Model.knex(db);
    });

    afterAll(async () => {
        await dropDatabase(db);
    });

    afterEach(async () => {
        await truncateDatabase(db);
    });

    const products = JSON.parse(fs.readFileSync(
        './fixtures/amazon/search-category-items.json'
    ));

    it('imports stuff', async () => {
        const amaApiClient = setupApiClient();

        const [catA, catB] = await createCategories();
        await categoryRepo.markQueuedProductsImport(catB);
        const productImport = await catB.lastQueuedProductImport();

        const searchCategoryProducts = jest.fn();
        searchCategoryProducts.mockReturnValueOnce((async function* () {
            for (const product of products) {
                yield product;
            }
        }()));

        const importCategoryProducts = new ImportCategoryProducts(
            amaApiClient,
            searchCategoryProducts
        );

        await importCategoryProducts.execute({
            categoryId: catB.id,
            categoryProductImportId: productImport.id,
        });

        expect(searchCategoryProducts).toHaveBeenCalledWith(amaApiClient, catB.id);

        for (const product of products) {
            const dbProduct = await catA.$relatedQuery('products')
                .findOne({asin: product.ASIN});

            expect(dbProduct).toBeDefined();
            expect(dbProduct.parentAsin).toBe(product.ParentASIN || null);
        }
    });

    it('doesnt crash when storing a product fails', async () => {
        const amaApiClient = setupApiClient();

        const [catA, catB] = await createCategories();
        await categoryRepo.markQueuedProductsImport(catB);
        const productImport = await catB.lastQueuedProductImport();

        const searchCategoryProducts = jest.fn();
        searchCategoryProducts.mockReturnValueOnce((async function* () {
            yield {
            };

            for (const product of products) {
                yield product;
            }
        }()));

        const importCategoryProducts = new ImportCategoryProducts(
            amaApiClient,
            searchCategoryProducts
        );

        await importCategoryProducts.execute({
            categoryId: catB.id,
            categoryProductImportId: productImport.id,
        });

        expect(searchCategoryProducts).toHaveBeenCalledWith(amaApiClient, catB.id);

        for (const product of products) {
            const dbProduct = await catA.$relatedQuery('products')
                .findOne({asin: product.ASIN});

            expect(dbProduct).toBeDefined();
            expect(dbProduct.parentAsin).toBe(product.ParentASIN || null);
        }
    });

    it('will update existing products', async () => {
        const amaApiClient = setupApiClient();

        const [catA, catB] = await createCategories();
        await categoryRepo.markQueuedProductsImport(catB);
        const productImport = await catB.lastQueuedProductImport();

        const searchCategoryProducts = jest.fn();
        searchCategoryProducts.mockReturnValueOnce((async function* () {
            yield {
                ASIN: 'alpha12345',
                BrowseNodeInfo: {
                    BrowseNodes: [
                        {Id: '1'},
                        {Id: '2'},
                    ],
                },
                Magic: true,
            };

            yield {
                ASIN: 'alpha12345',
                BrowseNodeInfo: {
                    BrowseNodes: [
                        {Id: '2'},
                        {Id: '3'},
                    ],
                },
                Magic: false,
            };
        }()));

        const importCategoryProducts = new ImportCategoryProducts(
            amaApiClient,
            searchCategoryProducts
        );

        await importCategoryProducts.execute({
            categoryId: catB.id,
            categoryProductImportId: productImport.id,
        });

        expect(searchCategoryProducts).toHaveBeenCalledWith(amaApiClient, catB.id);

        const product = await Product.query()
            .withGraphFetched('categories')
            .findOne({asin: 'alpha12345'});

        expect(product).toBeDefined();
        expect(product.categories.length).toBe(1);
        expect(product.categories).toMatchObject([{
            id: '2',
        }]);

        expect(product.data).toMatchObject({
            Magic: false,
        });
    });

    it('will mark the product import as started and stopped', async () => {
        const amaApiClient = setupApiClient();

        const [catA, catB] = await createCategories();
        await categoryRepo.markQueuedProductsImport(catB);
        let productImport = await catB.lastQueuedProductImport();

        const searchCategoryProducts = jest.fn();
        searchCategoryProducts.mockReturnValueOnce((async function* () {
            return;
        }()));

        const importCategoryProducts = new ImportCategoryProducts(
            amaApiClient,
            searchCategoryProducts
        );

        await importCategoryProducts.execute({
            categoryId: catB.id,
            categoryProductImportId: productImport.id,
        });


        productImport = await productImport.$query();
        expect(productImport).toBeDefined();
        expect(productImport.startedAt).not.toBeNull();
        expect(productImport.stoppedAt).not.toBeNull();
    });

    function setupApiClient() {
        return {
            searchCategoryItems: jest.fn(),
        };
    }

    /**
     *
     * @returns {Category[]}
     */
    async function createCategories() {
        const data = [
            {id: '1', rootId: '1'},
            {id: '2', rootId: '2'},
        ];

        const defaults = {
            displayName: 'a',
            contextFreeName: 'a',
        };

        return await Promise
            .all(data.map(d => Category.query().insertAndFetch({...defaults, ...d})));
    }
});
