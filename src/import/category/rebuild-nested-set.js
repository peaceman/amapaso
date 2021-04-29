const { CategoryRepo } = require('../../database/repos');
const log = require('../../log');

class RebuildCategoryNestedSet {
    /**
     * @param {CategoryRepo} categoryRepo
     */
    constructor(categoryRepo) {
        this.categoryRepo = categoryRepo;
    }

    async execute() {
        log.info('Start rebuilding category nested set');

        await this.categoryRepo.rebuildNestedSet();

        log.info("Finished rebuilding category nested set");
    }
}

module.exports = {
    RebuildCategoryNestedSet,
};
