const Redis = require('ioredis');
const config = require('config');

const { DailyRateLimitBreachDetector } = require('./detector');
const { DailyRateLimitBreachStorage } = require('./storage');

const redis = new Redis(config.get('redis.connectionUrl'));
const storage = new DailyRateLimitBreachStorage(redis);
const detector = new DailyRateLimitBreachDetector(storage);

module.exports = {
    DailyRateLimitBreachDetector,
    DailyRateLimitBreachStorage,
    dailyRateLimitBreachDetector: detector,
};
