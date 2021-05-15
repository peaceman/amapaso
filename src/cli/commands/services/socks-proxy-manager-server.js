const { Storage } = require("../../../socks-proxy-manager/storage");
const Redis = require('ioredis');
const config = require('config');
const { SocksProxyManagerServer } = require("../../../socks-proxy-manager/server/server");
const log = require('../../../log');

exports.command = 'socks-proxy-manager-server';
exports.describe = 'starts the socks proxy manager server';
exports.handler = async argv => {
    const storage = new Storage(new Redis(config.get('redis.connectionUrl')));
    const proxyManager = new SocksProxyManagerServer(
        config.get('socksProxyManager'),
        storage,
    );

    log.info('Starting socks proxy manager');
    await proxyManager.start();
};
