const { RebuildCategoryNestedSet } = require("./rebuild-nested-set");

describe('rebuild nested set', () => {
    it('calls the category repo', async () => {
        const categoryRepo = {
            rebuildNestedSet: jest.fn(),
        };

        const rebuildNestedSet = new RebuildCategoryNestedSet(categoryRepo);
        await rebuildNestedSet.execute();

        expect(categoryRepo.rebuildNestedSet).toHaveBeenCalled();
    });
});
