const { createDatabase, dropDatabase, truncateDatabase } = require('../../test/database');
const { Model } = require('objection');
const { CategoryRepo } = require('./category-repo');
const Category = require('../models/Category');
const { subDays } = require('date-fns');

describe('category repo integration tests', () => {
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

    const categoryDefaults = {
        displayName: 'a',
        contextFreeName: 'a',
    };

    it('builds a nested set per category root', async () => {
        // insert test data
        const data = [
            // first root
            { id: 1, rootId: 1, nsLeft: 1, nsRight: 10 },
            { id: 2, rootId: 1, nsLeft: 2, nsRight: 7, parentId: 1 },
            { id: 3, rootId: 1, nsLeft: 8, nsRight: 9, parentId: 1 },
            { id: 4, rootId: 1, nsLeft: 3, nsRight: 4, parentId: 2 },
            { id: 5, rootId: 1, nsLeft: 5, nsRight: 6, parentId: 2 },

            // second root
            { id: 6, rootId: 6, nsLeft: 1, nsRight: 10 },
            { id: 7, rootId: 6, nsLeft: 2, nsRight: 7, parentId: 6 },
            { id: 8, rootId: 6, nsLeft: 8, nsRight: 9, parentId: 6 },
            { id: 9, rootId: 6, nsLeft: 3, nsRight: 4, parentId: 7 },
            { id: 10, rootId: 6, nsLeft: 5, nsRight: 6, parentId: 7 },
        ];

        for (const v of data) {
            await Category
                .fromDatabaseJson({
                    ...v,
                    ...categoryDefaults,
                    nsLeft: undefined,
                    nsRight: undefined,
                })
                .$query()
                .insert();
        }

        // execute
        const repo = new CategoryRepo();
        await repo.rebuildNestedSet();

        // check
        for (const v of data) {
            const cat = await Category.query().findById(v.id);

            expect(cat).toEqual(expect.objectContaining(v));
        }
    });

    it('fetches eligible categories for the periodic product import', async () => {
        // category without import
        const [categoryWithoutImport] = await Category
            .query()
            .insertGraphAndFetch([
                {
                    id: '1',
                    rootId: '1',
                    ...categoryDefaults,
                }
            ]);

        // category with queued import
        const [categoryWithQueuedImport] = await Category
            .query()
            .insertGraphAndFetch([
                {
                    id: '2',
                    rootId: '1',
                    ...categoryDefaults,
                    productImports: [
                        {
                            queuedAt: new Date().toISOString(),
                        }
                    ]
                }
            ]);

        // category with old stopped import
        const [categoryWithOldStoppedImport] = await Category
            .query()
            .insertGraphAndFetch([
                {
                    id: '3',
                    rootId: '1',
                    ...categoryDefaults,
                    productImports: [
                        {
                            queuedAt: subDays(new Date(), 90).toISOString(),
                            startedAt: subDays(new Date(), 89).toISOString(),
                            stoppedAt: subDays(new Date(), 88).toISOString(),
                        },
                    ],
                },
            ]);

        // category with recently stopped import
        const [categoryWithRecentlyStoppedImport] = await Category
            .query()
            .insertGraphAndFetch([
                {
                    id: '4',
                    rootId: '1',
                    ...categoryDefaults,
                    productImports: [
                        {
                            queuedAt: subDays(new Date(), 5).toISOString(),
                            startedAt: subDays(new Date(), 4).toISOString(),
                            stoppedAt: subDays(new Date(), 3).toISOString(),
                        },
                    ],
                },
            ]);

        // execute
        const repo = new CategoryRepo();
        const categories = await repo.fetchEligibleForPeriodicProductsImport();

        // assert
        expect(categories.length).toBe(2);
    });

    it('marks queued product imports', async () => {
        const category = await Category.query()
            .insert({
                id: '1',
                rootId: '1',
                ...categoryDefaults,
            });

        // execute
        const repo = new CategoryRepo();
        await repo.markQueuedProductsImport(category);

        const productImports = await category.$relatedQuery('productImports');
        expect(productImports.length).toBe(1);
    });
});
