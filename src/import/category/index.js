const { ImportCategoryTree } = require('./import-category-tree');
const { RebuildCategoryNestedSet } = require('./rebuild-nested-set');
const { categoryRepo } = require('../../database/repos');
const { apiClient: amaApiClient } = require('../../amazon/api');

const importCategoryTree = new ImportCategoryTree(categoryRepo, amaApiClient);
const rebuildCategoryNestedSet = new RebuildCategoryNestedSet(categoryRepo);

module.exports = {
    importCategoryTree,
    rebuildCategoryNestedSet
};
