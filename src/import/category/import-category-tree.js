const fs = require('fs');
const parse = require('csv-parse');
const { extractFirstChildNodePerPerRootNode, fetchRootNodeIdsFromChilds, fetchAndStoreNodeHierarchy } = require('../../amazon/category-import');
const Category = require('../../database/models/Category');

/**
 * @typedef {Object} ImportCategoryTreeRequestDTO
 * @property {string} csvFilePath
 */

class ImportCategoryTree {
    constructor(categoryRepo, amaApiClient) {
        this.categoryRepo = categoryRepo;
        this.amaApiClient = amaApiClient;
    }

    /**
     * @param {ImportCategoryTreeRequestDTO} request
     */
    async execute(request) {
        const asyncRecordGen = this.createAsyncRecordGen(request.csvFilePath);

        // fetch root node ids
        const rootNodeIds = await this.fetchRootNodeIds(asyncRecordGen);

        await fetchAndStoreNodeHierarchy(
            this.amaApiClient,
            category => this.storeCategory(category),
            rootNodeIds
        );
    }

    async fetchRootNodeIds(recordGenerator) {
        const childNodeIds = await extractFirstChildNodePerPerRootNode(
            {rootNode: 0, childNode: 1},
            recordGenerator
        );

        const rootNodeIds = await fetchRootNodeIdsFromChilds(this.amaApiClient, childNodeIds);

        return rootNodeIds;
    }

    async storeCategory(categoryDTO) {
        const category = Category.fromJson(categoryDTO);

        await this.categoryRepo.save(category);
    }

    /**
     * @param {string} filePath
     */
    createAsyncRecordGen(filePath) {
        const parser = fs.createReadStream(filePath)
            .pipe(parse({
                from_line: 2, // skip column headers
                skip_empty_lines: true
            }));

        return parser;
    }
}

module.exports = {
    ImportCategoryTree,
};
