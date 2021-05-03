const { Model } = require('objection');
const BaseModel = require('./BaseModel');

class Product extends BaseModel {
    static get tableName() {
        return 'products';
    }

    static get jsonSchema() {
        return {
            type: 'object',
            properties: {
                asin: { type: 'string', minLength: 10, maxLength: 10 },
                parentAsin: { type: ['string', 'null'], minLength: 10, maxLength: 10 },
                data: {
                    type: 'object',
                }
            }
        };
    }

    static get relationMappings() {
        const Category = require('./Category');

        return {
            categories: {
                relation: Model.ManyToManyRelation,
                modelClass: Category,
                join: {
                    from: 'products.asin',
                    through: {
                        from: 'product_categories.productAsin',
                        to: 'product_categories.categoryId',
                    },
                    to: 'categories.id',
                },
            },
            parent: {
                relation: Model.BelongsToOneRelation,
                modelClass: Product,
                join: {
                    from: 'products.parentAsin',
                    to: 'products.asin',
                },
            },
            children: {
                relation: Model.HasManyRelation,
                modelClass: Product,
                join: {
                    from: 'products.asin',
                    to: 'products.parentAsin',
                },
            },
        };
    }
}

module.exports = Product;
