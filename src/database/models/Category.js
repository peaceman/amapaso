const { Model } = require('objection');
const BaseModel = require('./BaseModel');
const CategoryProductImport = require('./CategoryProductImport');

class Category extends BaseModel {
    static get tableName() {
        return 'categories';
    }

    static get jsonSchema() {
        return {
            type: 'object',
            properties: {
                id: { type: 'string' },
                rootId: { type: 'string' },
                parentId: { type: ['string', 'null'], default: null },
                nsLeft: { type: ['number', 'null'], default: null },
                nsRight: { type: ['number', 'null'], default: null },
                displayName: { type: 'string' },
                contextFreeName: { type: 'string' },
            },
        };
    }

    static get relationMappings() {
        const CategoryProductImport = require('./CategoryProductImport');
        const Product = require('./Product');

        return {
            productImports: {
                relation: Model.HasManyRelation,
                modelClass: CategoryProductImport,
                join: {
                    from: 'categories.id',
                    to: 'category_product_imports.category_id',
                },
            },
            products: {
                relation: Model.ManyToManyRelation,
                modelClass: Product,
                join: {
                    from: 'categories.id',
                    through: {
                        from: 'product_categories.category_id',
                        to: 'product_categories.product_asin',
                    },
                    to: 'products.asin',
                },
            },
        };
    }

    /**
     * @returns {Promise<CategoryProductImport | undefined>}
     */
    async lastQueuedProductImport() {
        return await this.$relatedQuery('productImports')
            .orderBy('queued_at', 'desc')
            .first();
    }
}

module.exports = Category;
