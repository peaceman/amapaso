const { Model } = require('objection');
const BaseModel = require('./BaseModel');

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

        return {
            productImports: {
                relation: Model.HasManyRelation,
                modelClass: CategoryProductImport,
                join: {
                    from: 'categories.id',
                    to: 'category_product_imports.category_id',
                },
            },
        };
    }
}

module.exports = Category;
