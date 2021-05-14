const { Model } = require('objection');
const BaseModel = require('./BaseModel');

class ProductReviewImport extends BaseModel {
    static get tableName() {
        return 'product_review_imports';
    }

    static get jsonSchema() {
        return {
            type: 'object',
            properties: {
                id: { type: 'string' },
                productAsin: { type: 'string', minLength: 10, maxLength: 10 },
                queuedAt: {
                    type: 'string',
                    format: 'date-time',
                },
                startedAt: {
                    type: ['string', 'null'],
                    format: 'date-time',
                },
                stoppedAt: {
                    type: ['string', 'null'],
                    format: 'date-time',
                },
            }
        };
    }

    static get relationMappings() {
        const Product = require('./Product');

        return {
            product: {
                relation: Model.BelongsToOneRelation,
                modelClass: Product,
                join: {
                    from: 'product_review_imports.product_asin',
                    to: 'products.asin',
                },
            },
        };
    }

    async markAsStarted() {
        await this.$query()
            .patch({startedAt: new Date().toISOString()});
    }

    async markAsStopped() {
        await this.$query()
            .patch({stoppedAt: new Date().toISOString()});
    }
}

module.exports = ProductReviewImport;
