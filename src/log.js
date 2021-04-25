const bunyan = require('bunyan');

const log = bunyan.createLogger({name: 'amapaso'});

module.exports = log;
