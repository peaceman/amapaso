const config = require('config');

const { ApiClient } = require('./client');
const { limiter,
    dailyRateLimitBreachDetector,
    DailyRateLimitBreachDetector,
    reachedDailyLimit
} = require('./rate-limit');

const apiClient = new ApiClient(config.get('amazon'), limiter);
dailyRateLimitBreachDetector.watchApiClient(apiClient);
dailyRateLimitBreachDetector.on(
    DailyRateLimitBreachDetector.EVENTS.RATE_LIMIT_BREACHED,
    reachedDailyLimit
);

module.exports = {
    apiClient,
};
