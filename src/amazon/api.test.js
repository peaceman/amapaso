const EventEmitter = require('events');
const {
    ApiClient,
    DailyRateLimitBreachDetector,
    TooManyRequestsError,
    DailyRateLimitBreachStorage,
} = require('./api');

describe('daily rate limit breach detector', () => {
    const breachLimit = 5;
    const apiClientConfigHash = 'foo';

    function setupStorage() {
        return {
            addFailedRequest: jest.fn(),
            addSucceededRequest: jest.fn(),
            getFailedRequestCount: jest.fn().mockReturnValue(breachLimit),
        };
    }

    function setupApiClient() {
        const apiClient = new EventEmitter();
        apiClient.getConfigHash = jest.fn().mockReturnValue(apiClientConfigHash);

        return apiClient;
    }

    it('reports a breach if failed request count exceeds the breach limit', async () => {
        const storage = setupStorage();
        const apiClient = setupApiClient();

        const detector = new DailyRateLimitBreachDetector(storage, {breachLimit});
        const breachDetected = new Promise(resolve => {
            detector.on(DailyRateLimitBreachDetector.EVENTS.RATE_LIMIT_BREACHED, resolve);
        });

        detector.watchApiClient(apiClient);

        apiClient.emit(
            ApiClient.EVENTS.REQUEST_FAILED,
            new TooManyRequestsError(),
        );

        expect(await breachDetected).toBe(apiClient);
        expect(storage.getFailedRequestCount.mock.calls).toContainEqual([apiClientConfigHash]);
    });

    it('doesnt report a breach if failed request count is below the breach limit', async () => {
        const storage = setupStorage();
        const apiClient = setupApiClient();

        const detector = new DailyRateLimitBreachDetector(storage, {breachLimit: breachLimit + 1});
        const breachDetected = jest.fn();

        detector.watchApiClient(apiClient);
        detector.on(DailyRateLimitBreachDetector.EVENTS.RATE_LIMIT_BREACHED, breachDetected);

        apiClient.emit(
            ApiClient.EVENTS.REQUEST_FAILED,
            new TooManyRequestsError()
        );

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(breachDetected.mock.calls.length).toBe(0);
        expect(storage.getFailedRequestCount.mock.calls).toContainEqual([apiClientConfigHash]);
    });

    it('adds failed requests to storage', async () => {
        const storage = setupStorage();
        const apiClient = setupApiClient();

        const detector = new DailyRateLimitBreachDetector(storage, {breachLimit});
        detector.watchApiClient(apiClient);

        apiClient.emit(
            ApiClient.EVENTS.REQUEST_FAILED,
            new TooManyRequestsError(),
        );

        expect(storage.addFailedRequest).toHaveBeenCalledWith(apiClientConfigHash, breachLimit);
    });

    it('adds successful requests to storage', async () => {
        const storage = setupStorage();
        const apiClient = setupApiClient();

        const detector = new DailyRateLimitBreachDetector(storage, {breachLimit});
        detector.watchApiClient(apiClient);

        apiClient.emit(ApiClient.EVENTS.REQUEST_SUCEEDED);

        expect(storage.addSucceededRequest).toHaveBeenCalledWith(apiClientConfigHash, breachLimit);
    });

    it('adds only too many request errors as failed request', async () => {
        const storage = setupStorage();
        const apiClient = setupApiClient();

        const detector = new DailyRateLimitBreachDetector(storage, {breachLimit});
        detector.watchApiClient(apiClient);

        apiClient.emit(
            ApiClient.EVENTS.REQUEST_FAILED,
            new Error(),
        );

        expect(storage.addFailedRequest.mock.calls.length).toBe(0);
        expect(storage.addSucceededRequest).toHaveBeenCalledWith(apiClientConfigHash, breachLimit);
    })
});

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

        expect(redis.lpush).toHaveBeenCalledWith(`rlb-${identifier}`, false);
        expect(redis.ltrim).toHaveBeenCalledWith(`rlb-${identifier}`, 0, limit - 1);
    });

    it('adds failed requests as false and trims the list to limit', async () => {
        const redis = setupRedis();
        const storage = new DailyRateLimitBreachStorage(redis);

        await storage.addSucceededRequest(identifier, limit);

        expect(redis.lpush).toHaveBeenCalledWith(`rlb-${identifier}`, true);
        expect(redis.ltrim).toHaveBeenCalledWith(`rlb-${identifier}`, 0, limit - 1);
    });

    it('counts failed requests', async () => {
        const redis = setupRedis();
        const storage = new DailyRateLimitBreachStorage(redis);

        redis.lrange.mockReturnValue([false, false, true, false]);

        const failedRequestCount = await storage.getFailedRequestCount(identifier);

        expect(failedRequestCount).toBe(2);
        expect(redis.lrange).toHaveBeenCalledWith(`rlb-${identifier}`, 0, -1);
    });
});
