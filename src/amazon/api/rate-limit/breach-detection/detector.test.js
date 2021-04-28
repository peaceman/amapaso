const EventEmitter = require('events');
const { DailyRateLimitBreachDetector } = require('./detector');
const { ApiClient } = require('../../client');
const { TooManyRequestsError } = require('../../errors');

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
