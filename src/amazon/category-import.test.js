const fs = require('fs');
const {
    extractFirstChildNodePerPerRootNode,
    fetchRootNodeIdsFromChilds,
    fetchAndStoreNodeHierarchy,
} = require('./category-import');

describe('extract first child node per root node', () => {
    const columnMappings = {
        rootNode: 0,
        childNode: 1
    };

    test('regular', () => {
        const dataGenerator = createAsyncGeneratorFromArray([
            ['foo', 'first foo child'],
            ['foo', 'second foo child'],
            ['bar', 'first bar child'],
            ['bar', 'second bar child'],
        ]);

        return expect(extractFirstChildNodePerPerRootNode(columnMappings, dataGenerator))
            .resolves
            .toStrictEqual([
                'first foo child',
                'first bar child',
            ]);
    });

    test('skips incomplete rows', () => {
        const dataGenerator = createAsyncGeneratorFromArray([
            ['foo', 'first foo child'],
            [undefined, 'undefined child'],
            ['bar', 'first bar child'],
        ]);

        return expect(extractFirstChildNodePerPerRootNode(columnMappings, dataGenerator))
            .resolves
            .toStrictEqual([
                'first foo child',
                'first bar child',
            ]);
    })
});

describe('fetch root node ids from childs', () => {
    const childNodeIds = [
        'alpha child',
        'beta child',
        'gamma child',
    ];

    const browseNodesFromChilds = JSON.parse(fs.readFileSync(
        './fixtures/amazon/browse-nodes-from-childs.json'
    ));

    test('regular', async () => {
        const getBrowseNodes = jest.fn();
        getBrowseNodes.mockReturnValueOnce(browseNodesFromChilds);

        const getBrowseNodesLimit = jest.fn().mockReturnValueOnce(10);
        const apiClient = {
            getBrowseNodes,
            getBrowseNodesLimit,
        };

        await expect(fetchRootNodeIdsFromChilds(apiClient, childNodeIds))
            .resolves
            .toStrictEqual([
                '908823031',
                '77028031',
            ]);

        expect(getBrowseNodes).toHaveBeenCalledWith(childNodeIds);
    });

    test('multiple calls if the browse nodes limit is breached', async () => {
        const getBrowseNodes = jest.fn().mockReturnValue([]);
        const getBrowseNodesLimit = jest.fn().mockReturnValueOnce(1);

        const apiClient = {
            getBrowseNodes,
            getBrowseNodesLimit,
        };

        await expect(fetchRootNodeIdsFromChilds(apiClient, childNodeIds))
            .resolves
            .toStrictEqual([]);

        expect(getBrowseNodes.mock.calls.length).toBe(childNodeIds.length);
    });
});

describe('fetch and store node hierarchy', () => {
    const browseNodesResult = JSON.parse(fs.readFileSync(
        './fixtures/amazon/browse-nodes-root.json'
    ));

    test('regular', async () => {
        const rootNodeIds = ['root alpha', 'root beta'];
        const getBrowseNodesLimit = jest.fn().mockReturnValueOnce(10);
        const getBrowseNodes = jest.fn()
            .mockReturnValueOnce(browseNodesResult)
            .mockReturnValue([]);

        const apiClient = {
            getBrowseNodes,
            getBrowseNodesLimit,
        };

        const storeCategory = jest.fn();

        await fetchAndStoreNodeHierarchy(apiClient, storeCategory, rootNodeIds);

        for (const parentNode of browseNodesResult) {
            expect(storeCategory.mock.calls).toContainEqual([{
                id: parentNode['Id'],
                rootId: parentNode['Id'],
                parentId: undefined,
                displayName: parentNode['DisplayName'],
                contextFreeName: parentNode['ContextFreeName'],
            }]);

            expect(getBrowseNodes.mock.calls)
                .toContainEqual([parentNode['Children'].map(v => v['Id'])]);

            for (const childNode of parentNode['Children']) {
                expect(storeCategory.mock.calls).toContainEqual([{
                    id: childNode['Id'],
                    rootId: parentNode['Id'],
                    parentId: parentNode['Id'],
                    displayName: childNode['DisplayName'],
                    contextFreeName: childNode['ContextFreeName'],
                }]);
            }
        }
    });

    test('multiple calls if the browse nodes limit is breached', async () => {
        const rootNodeIds = ['root alpha', 'root beta'];
        const getBrowseNodesLimit = jest.fn().mockReturnValueOnce(1);

        const getBrowseNodes = jest.fn()
            .mockReturnValue([]);

        const apiClient = {
            getBrowseNodes,
            getBrowseNodesLimit,
        };

        const storeCategory = jest.fn();

        await fetchAndStoreNodeHierarchy(apiClient, storeCategory, rootNodeIds);

        expect(getBrowseNodes.mock.calls.length).toBe(2);
    });

    it('sets the root node id correct during nested fetches', async () => {
        const rootNode = {
            Id: '23',
            ContextFreeName: 'root',
            DisplayName: 'root',
        };

        const firstLevelChild = {
            Id: '24',
            ContextFreeName: 'first level child',
            DisplayName: 'first level child',
        };

        const secondLevelChild = {
            Id: '25',
            ContextFreeName: 'second level child',
            DisplayName: 'second level child',
        };

        const getBrowseNodesLimit = jest.fn().mockReturnValueOnce(1);
        const getBrowseNodes = jest.fn()
            .mockReturnValueOnce([
                {
                    ...rootNode,
                    Children: [
                        firstLevelChild
                    ],
                }
            ])
            .mockReturnValueOnce([
                {
                    ...firstLevelChild,
                    Children: [
                        secondLevelChild
                    ]
                }
            ])
            .mockReturnValue([]);

        const apiClient = {
            getBrowseNodes,
            getBrowseNodesLimit,
        };

        const storeCategory = jest.fn();

        await fetchAndStoreNodeHierarchy(apiClient, storeCategory, [rootNode.Id]);

        expect(storeCategory.mock.calls).toContainEqual([{
            id: rootNode.Id,
            rootId: rootNode.Id,
            parentId: undefined,
            displayName: rootNode.DisplayName,
            contextFreeName: rootNode.ContextFreeName,
        }]);

        expect(storeCategory.mock.calls).toContainEqual([{
            id: firstLevelChild.Id,
            rootId: rootNode.Id,
            parentId: rootNode.Id,
            displayName: firstLevelChild.DisplayName,
            contextFreeName: firstLevelChild.ContextFreeName,
        }]);

        expect(storeCategory.mock.calls).toContainEqual([{
            id: secondLevelChild.Id,
            rootId: rootNode.Id,
            parentId: firstLevelChild.Id,
            displayName: secondLevelChild.DisplayName,
            contextFreeName: secondLevelChild.ContextFreeName,
        }]);
    });
});

async function* createAsyncGeneratorFromArray(data) {
    for (const row of data) {
        yield row;
    }
}
