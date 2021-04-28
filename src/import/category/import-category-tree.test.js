const { ImportCategoryTree } = require('./import-category-tree');
const CategoryImport = require('../../amazon/category-import');

jest.mock('../../amazon/category-import');

describe('import category tree', () => {
    const amaApiClient = {};

    it('executes', async () => {
        const categoryRepo = setupCategoryRepo();
        const asyncRecordGen = {};
        const childNodeIds = ['23', '5'];
        const rootNodeIds = ['123', '234'];
        const category = {
            id: '23',
            rootId: '23',
            parentId: undefined,
            displayName: 'root',
            contextFreeName: 'root',
        };

        ImportCategoryTree.prototype.createAsyncRecordGen = jest.fn()
            .mockReturnValue(asyncRecordGen);

        CategoryImport.extractFirstChildNodePerPerRootNode.mockResolvedValue(childNodeIds);
        CategoryImport.fetchRootNodeIdsFromChilds.mockResolvedValue(rootNodeIds);
        CategoryImport
            .fetchAndStoreNodeHierarchy
            .mockImplementation((apiClient, storeCategory, rootNodeIds) => {
                storeCategory(category);
            });

        const importCategoryTree = new ImportCategoryTree(categoryRepo, amaApiClient);
        await importCategoryTree.execute({
            csvFilePath: 'foobar.csv',
        });

        expect(ImportCategoryTree.prototype.createAsyncRecordGen.mock.calls)
            .toContainEqual(['foobar.csv']);
        expect(CategoryImport.extractFirstChildNodePerPerRootNode.mock.calls[0][1])
            .toBe(asyncRecordGen);
        expect(CategoryImport.fetchRootNodeIdsFromChilds.mock.calls)
            .toContainEqual([amaApiClient, childNodeIds]);

        expect(CategoryImport.fetchAndStoreNodeHierarchy.mock.calls[0])
            .toEqual(expect.arrayContaining([amaApiClient, rootNodeIds]));

        expect(categoryRepo.save.mock.calls[0][0]).toMatchObject({...category, parentId: null});
    });

    function setupCategoryRepo() {
        return {
            save: jest.fn(),
        };
    }
});
