const { CategoryRepo } = require('./category-repo');
const { ProductRepo } = require('./product-repo');

const categoryRepo = new CategoryRepo();
const productRepo = new ProductRepo();

module.exports = {
    CategoryRepo,
    ProductRepo,
    categoryRepo,
    productRepo,
};
