const { CategoryRepo } = require('./category-repo');

const categoryRepo = new CategoryRepo();

module.exports = {
    CategoryRepo,
    categoryRepo,
};
