const Knex = require('knex');
const config = require('config');

const databaseName = `amapaso_test_${process.env.JEST_WORKER_ID}`;

function openConnection(databaseName = undefined) {
    return Knex({
        client: 'mysql2',
        connection: {
            host: config.get('database.host'),
            port: config.get('database.port'),
            user: config.get('database.user'),
            password: config.get('database.password'),
            database: databaseName,
        }
    });
}

async function createDatabase() {
    let knex = openConnection();

    console.log(`creating database ${databaseName}, dropping if it already exists`);
    await knex.raw(`drop database if exists \`${databaseName}\``);
    await knex.raw(`create database \`${databaseName}\``);
    await knex.destroy()

    knex = openConnection(databaseName);
    console.log(`migrating database ${databaseName}`);
    await knex.migrate.latest();

    return knex;
}

async function dropDatabase(knex) {
    console.log(`dropping database ${databaseName}`);
    await knex.raw(`drop database\`${databaseName}\``);
    await knex.destroy();
}

async function resetDatabase(knex) {
}

module.exports = {
    createDatabase,
    dropDatabase,
};