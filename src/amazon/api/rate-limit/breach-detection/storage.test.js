const { DailyRateLimitBreachStorage } = require('./storage');

describe('daily rate limit breach storage', () => {
    const identifier = 'foobar';
    const limit = 2;

    function setupRedis() {
        const redis = {
            lpush: jest.fn(),
            ltrim: jest.fn(),
            lrange: jest.fn(),
        };

        return redis;
    }

    it('adds failed requests as false and trims the list to limit', async () => {
        const redis = setupRedis();
        const storage = new DailyRateLimitBreachStorage(redis);

        await storage.addFailedRequest(identifier, limit);

        expect(redis.lpush).toHaveBeenCalledWith(`rlb-${identifier}`, JSON.stringify(false));
        expect(redis.ltrim).toHaveBeenCalledWith(`rlb-${identifier}`, 0, limit - 1);
    });

    it('adds failed requests as false and trims the list to limit', async () => {
        const redis = setupRedis();
        const storage = new DailyRateLimitBreachStorage(redis);

        await storage.addSucceededRequest(identifier, limit);

        expect(redis.lpush).toHaveBeenCalledWith(`rlb-${identifier}`, JSON.stringify(true));
        expect(redis.ltrim).toHaveBeenCalledWith(`rlb-${identifier}`, 0, limit - 1);
    });

    it('counts failed requests', async () => {
        const redis = setupRedis();
        const storage = new DailyRateLimitBreachStorage(redis);

        redis.lrange.mockReturnValue([false, false, true, false].map(v => JSON.stringify(v)));

        const failedRequestCount = await storage.getFailedRequestCount(identifier);

        expect(failedRequestCount).toBe(2);
        expect(redis.lrange).toHaveBeenCalledWith(`rlb-${identifier}`, 0, -1);
    });
});
