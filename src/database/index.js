const Knex = require('knex');
const { Model } = require('objection');
const knexConfig = require('../../knexfile');
const log = require('../log');

const knex = Knex({
    ...knexConfig,
    pool: {
        afterCreate: (conn, done) => {
            log.info('Established new database connection', {
                host: conn?.config?.host,
                port: conn?.config?.port,
                socketPath: conn?.config?.socketPath,
            });

            done(false, conn);
        },
    },
});

Model.knex(knex);

module.exports = {
    knex,
};
