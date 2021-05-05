require('dotenv').config()
const config = require('config');

module.exports = {
  client: 'mysql2',
  connection: {
    host: config.get('database.host'),
    port: config.get('database.port'),
    user: config.get('database.user'),
    password: config.get('database.password'),
    database: config.get('database.name'),
    supportBigNumbers: true,
    bigNumberStrings: true,
  },
};
