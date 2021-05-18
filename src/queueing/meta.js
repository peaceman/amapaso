const QUEUE_NAME = '🥦';
const JOBS = Object.freeze({
    QUEUE_IMPORT_CATEGORY_PRODUCTS: 'queue-import-category-products',
    IMPORT_CATEGORY_PRODUCTS: 'import-category-products',
    QUEUE_IMPORT_PRODUCT_REVIEWS: 'queue-import-product-reviews',
    IMPORT_PRODUCT_REVIEWS: 'import-product-reviews',
});

module.exports = {
    JOBS,
    QUEUE_NAME,
};
