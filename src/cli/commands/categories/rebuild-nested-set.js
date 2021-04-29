const { rebuildCategoryNestedSet } = require('../../../import/category');

exports.command = 'rebuild-nested-set';
exports.describe = 'rebuilds the category nested set structure';
exports.handler = async argv => {
    await rebuildCategoryNestedSet.execute();
    process.exit();
};
