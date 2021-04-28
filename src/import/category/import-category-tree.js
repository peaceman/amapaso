const fs = require('fs');
const parse = require('csv-parse');
const { extractFirstChildNodePerPerRootNode, fetchRootNodeIdsFromChilds, fetchAndStoreNodeHierarchy } = require('../../amazon/category-import');
const Category = require('../../database/models/Category');
const log = require('../../log');

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
        log.info('Start importing the category tree', {filePath: request.csvFilePath});
        const asyncRecordGen = this.createAsyncRecordGen(request.csvFilePath);

        // fetch root node ids
        const rootNodeIds = await this.fetchRootNodeIds(asyncRecordGen);

        log.info('Start fetching the full node hierarchy');
        await fetchAndStoreNodeHierarchy(
            this.amaApiClient,
            category => this.storeCategory(category),
            rootNodeIds
        );
    }

    async fetchRootNodeIds(recordGenerator) {
        log.info('Extracting first child node per root node');
        const childNodeIds = await extractFirstChildNodePerPerRootNode(
            {rootNode: 0, childNode: 1},
            recordGenerator
        );
        log.info('Found child node ids', {childNodeIds});

        log.info('Fetching root node ids from extracted child node ids');
        const rootNodeIds = await fetchRootNodeIdsFromChilds(this.amaApiClient, childNodeIds);
        log.info('Found root node ids', {rootNodeIds});

        return rootNodeIds;
    }

    async storeCategory(categoryDTO) {
        const category = Category.fromJson(categoryDTO);

        try {
            await this.categoryRepo.save(category);
            log.info('Stored category', {category});
        } catch (e) {
            log.warn('Failed storing category', {category, error: e});
            throw e;
        }
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
