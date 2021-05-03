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
}

module.exports = Category;
