const { Model } = require('objection');
const BaseModel = require('./BaseModel');

class ProductReview extends BaseModel {
    static get tableName() {
        return 'product_reviews';
    }

    static get jsonSchema() {
        return {
            type: 'object',
            required: [
                'id',
                'name',
                'title',
                'content',
                'points',
                'date',
            ],
            properties: {
                id: { type: 'string', maxLength: 32 },
                productAsin: { type: 'string', minLength: 10, maxLength: 10 },
                name: { type: 'string' },
                title: { type: 'string' },
                content: { type: 'string' },
                points: { type: 'number' },
                date: { type: 'string', format: 'date' },
            },
        };
    }

    static get relationMappings() {
        const Product = require('./Product');

        return {
            product: {
                relation: Model.BelongsToOneRelation,
                modelClass: Product,
                join: {
                    from: 'product_reviews.product_asin',
                    to: 'products.asin',
                },
            },
        };
    }
}

module.exports = ProductReview;
