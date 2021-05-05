const { Model } = require('objection');
const BaseModel = require('./BaseModel');

class CategoryProductImport extends BaseModel {
    static get tableName() {
        return 'category_product_imports';
    }

    static get jsonSchema() {
        return {
            type: 'object',
            properties: {
                id: { type: 'string' },
                categoryId: { type: 'string' },
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
        const Category = require('./Category');

        return {
            category: {
                relation: Model.BelongsToOneRelation,
                modelClass: Category,
                join: {
                    from: 'category_product_imports.category_id',
                    to: 'categories.id',
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

module.exports = CategoryProductImport;
