require('dotenv').config()
const config = require('config');

module.exports = {
  client: 'mysql2',
  connection: config.get('database.connectionUrl'),
};
