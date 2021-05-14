const { searchCategoryProducts } = require('./category-product-import');
const { unrollAsyncIterator } = require('../utils');

describe('search category products', () => {
    it('passes the given category id', async () => {
        const apiClient = setupApiClient();
        const categoryId = '23';

        apiClient.searchCategoryItems.mockReturnValueOnce([]);

        await unrollAsyncIterator(searchCategoryProducts(apiClient, categoryId));

        expect(apiClient.searchCategoryItems).toHaveBeenCalledTimes(1);
        expect(apiClient.searchCategoryItems).toHaveBeenCalledWith(categoryId, 1);
    });

    function setupApiClient() {
        return {
            searchCategoryItems: jest.fn(),
        };
    }

    it('pages until there are no more entries', async () => {
        const apiClient = setupApiClient();
        const categoryId = '23';

        apiClient.searchCategoryItems
            .mockReturnValueOnce([{}])
            .mockReturnValueOnce([{}])
            .mockReturnValueOnce([{}])
            .mockReturnValueOnce([]);

        await unrollAsyncIterator(searchCategoryProducts(apiClient, categoryId));

        expect(apiClient.searchCategoryItems).toHaveBeenCalledTimes(4);
        expect(apiClient.searchCategoryItems).toHaveBeenCalledWith(categoryId, 1);
        expect(apiClient.searchCategoryItems).toHaveBeenCalledWith(categoryId, 2);
        expect(apiClient.searchCategoryItems).toHaveBeenCalledWith(categoryId, 3);
        expect(apiClient.searchCategoryItems).toHaveBeenCalledWith(categoryId, 4);
    });

    it('pages at max until page 10', async () => {
        const apiClient = setupApiClient();
        const categoryId = '23';

        apiClient.searchCategoryItems
            .mockReturnValue([{}]);

        await unrollAsyncIterator(searchCategoryProducts(apiClient, categoryId));

        expect(apiClient.searchCategoryItems).toHaveBeenCalledTimes(10);
    });

    it('returns items given from the api', async () => {
        const apiClient = setupApiClient();
        const categoryId = '23';

        const apiItems = [[{}], [{}]];

        for (const items of apiItems) {
            apiClient.searchCategoryItems.mockReturnValueOnce(items);
        }

        apiClient.searchCategoryItems.mockReturnValue([]);

        const items = await unrollAsyncIterator(searchCategoryProducts(apiClient, categoryId));
        for (const item of apiItems.flat()) {
            expect(items).toContain(item);
        }
    });
});
