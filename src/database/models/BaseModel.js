const { Model, snakeCaseMappers } = require('objection');
const { knex } = require('..');

Model.knex(knex);

class BaseModel extends Model {
    static useTimestamps = true;

    static get columnNameMappers() {
        return snakeCaseMappers();
    }

    static get useLimitInFirst() {
        return true;
    }

    $beforeInsert() {
        this.createdAt = new Date();
    }

    $beforeUpdate() {
        this.updatedAt = new Date();
    }
}

module.exports = BaseModel;
