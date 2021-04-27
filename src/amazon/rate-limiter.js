const Bottleneck = require('bottleneck');
const config = require('config');
const log = require('../log');

const limiterConfig = config.get('amazon.rateLimiter');

const clientOptions = limiterConfig.get('datastore') === 'ioredis'
    ? config.get('redis.connectionUrl')
    : undefined;

const limiter = new Bottleneck({
    minTime: limiterConfig.get('minTime'),
    datastore: limiterConfig.get('datastore'),
    id: limiterConfig.get('id'),
    clientOptions,
});

function reachedDailyLimit() {
    log.info('reached daily paapi limit, empty the limiter reservoir');

    limiter.updateSettings({
        reservoir: 0,
        reservoirRefreshAmount: limiterConfig.get('dailyRequests'),
        reservoirRefreshInterval: 24 * 60 * 60 * 1000, // 24h
    });
}

module.exports = {
    limiter,
    reachedDailyLimit,
};
