const { Model } = require('objection');
const BaseModel = require('./BaseModel');

class Product extends BaseModel {
    static get tableName() {
        return 'products';
    }

    static get jsonSchema() {
        return {
            type: 'object',
            required: ['asin', 'data'],
            properties: {
                asin: { type: 'string', minLength: 10, maxLength: 10 },
                parentAsin: { type: ['string', 'null'], minLength: 10, maxLength: 10 },
                data: {
                    type: 'object',
                }
            }
        };
    }

    static get idColumn() {
        return 'asin';
    }

    static get relationMappings() {
        const Category = require('./Category');
        const ProductReview = require('./ProductReview');
        const ProductReviewImport = require('./ProductReviewImport');

        return {
            categories: {
                relation: Model.ManyToManyRelation,
                modelClass: Category,
                join: {
                    from: 'products.asin',
                    through: {
                        from: 'product_categories.product_asin',
                        to: 'product_categories.category_id',
                    },
                    to: 'categories.id',
                },
            },
            parent: {
                relation: Model.BelongsToOneRelation,
                modelClass: Product,
                join: {
                    from: 'products.parent_asin',
                    to: 'products.asin',
                },
            },
            children: {
                relation: Model.HasManyRelation,
                modelClass: Product,
                join: {
                    from: 'products.asin',
                    to: 'products.parent_asin',
                },
            },
            reviews: {
                relation: Model.HasManyRelation,
                modelClass: ProductReview,
                join: {
                    from: 'products.asin',
                    to: 'product_reviews.product_asin',
                },
            },
            reviewImports: {
                relation: Model.HasManyRelation,
                modelClass: ProductReviewImport,
                join: {
                    from: 'products.asin',
                    to: 'product_review_imports.product_asin',
                },
            },
        };
    }
}

module.exports = Product;
