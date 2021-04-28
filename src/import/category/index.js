const { ImportCategoryTree } = require('./import-category-tree');
const { categoryRepo } = require('../../database/repos');
const { apiClient: amaApiClient } = require('../../amazon/api');

const importCategoryTree = new ImportCategoryTree(categoryRepo, amaApiClient);

module.exports = {
    importCategoryTree,
};
