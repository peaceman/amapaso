const fs = require('fs');
const { ProductReviewFetcher, ProxyAwareProductReviewFetcher, productReviewUrl } = require("./product-review-fetcher");
const { unrollAsyncIterator } = require('../utils');
const axios = require('axios');
jest.mock('axios');

const curlOptionsExpect = expect.objectContaining({httpHeader: expect.any(Array)});

describe('product review fetcher', () => {
    it('fetches reviews', async () => {
        const asin = '1234567890';
        const curly = setupCurly();
        curly.get.mockReturnValueOnce({
            data: fs.readFileSync('fixtures/amazon/product-reviews.html').toString(),
        });

        const fetcher = new ProductReviewFetcher(curly, setupBrowserHeaderProvider());
        const reviews = await unrollAsyncIterator(fetcher.fetchReviews(asin));

        expect(curly.get)
            .toBeCalledWith(
                productReviewUrl(asin, 1),
                curlOptionsExpect
            );

        expect(reviews).not.toHaveLength(0);
        expect(reviews).toContainEqual({
            id: 'R26JK8Y3NTJN81',
            title: 'Guter stabiler Screen, aber viel zu teuer',
            name: 'Fugbaum',
            points: 2,
            date: new Date(2019, 7, 17),
            content: "Der DM-Screen ist sehr hilfreich im Spiel, aber 15-20€ für ein bedrucktes Stück Pappe finde ich dann doch etwas heftig.\nBei DSA4 z.B. war zwar der Schrim nicht so stabil, aber immerhin hat man noch ein Heft mit Preislisten und Übersichtstabellen zu Städten, Religion etc. bekommen.",
        });
    });

    it('fetches reviews from multiple pages until the max option is reached', async () => {
        const asin = '1234567890';
        const axios = setupCurly();
        axios.get.mockReturnValue({
            data: fs.readFileSync('fixtures/amazon/product-reviews.html').toString(),
        });

        const fetcher = new ProductReviewFetcher(axios, setupBrowserHeaderProvider());
        const reviews = await unrollAsyncIterator(fetcher.fetchReviews(asin, { max: 25 }));

        expect(axios.get.mock.calls).toEqual([
            [productReviewUrl(asin, 1), curlOptionsExpect],
            [productReviewUrl(asin, 2), curlOptionsExpect],
            [productReviewUrl(asin, 3), curlOptionsExpect],
        ]);

        expect(reviews).toHaveLength(25);
    });

    it('retries failed requests', async () => {
        const asin = '1234567890';
        const axios = setupCurly();
        axios.get.mockImplementationOnce(() => {
            throw new Error('hi');
        });

        axios.get.mockReturnValue({
            data: fs.readFileSync('fixtures/amazon/product-reviews.html').toString(),
        });

        const fetcher = new ProductReviewFetcher(axios, setupBrowserHeaderProvider());
        const reviews = await unrollAsyncIterator(fetcher.fetchReviews(asin, { max: 5 }));

        expect(axios.get.mock.calls).toEqual([
            [productReviewUrl(asin, 1), curlOptionsExpect],
            [productReviewUrl(asin, 1), curlOptionsExpect],
        ]);

        expect(reviews).toHaveLength(5);
    });

    it('detects captcha', async () => {
        const asin = '1234567890';
        const axios = setupCurly();
        axios.get.mockReturnValueOnce({
            data: fs.readFileSync('fixtures/amazon/bot.html').toString(),
        });

        axios.get.mockReturnValue({
            data: fs.readFileSync('fixtures/amazon/product-reviews.html').toString(),
        });

        const fetcher = new ProductReviewFetcher(axios, setupBrowserHeaderProvider());
        const reviews = await unrollAsyncIterator(fetcher.fetchReviews(asin, { max: 5 }));

        expect(axios.get.mock.calls).toEqual([
            [productReviewUrl(asin, 1), curlOptionsExpect],
            [productReviewUrl(asin, 1), curlOptionsExpect],
        ]);

        expect(reviews).toHaveLength(5);
    });

    it('uses browser header provider', async () => {
        const asin = '1234567890';
        const curly = setupCurly();
        const headers = [
            'Foo: bar',
            'Bar: foo',
        ];
        const browserHeaderProvider = setupBrowserHeaderProvider();
        browserHeaderProvider.get.mockReturnValue(headers);

        curly.get.mockReturnValueOnce({ data: 'html' });

        const fetcher = new ProductReviewFetcher(curly, browserHeaderProvider);
        const reviews = await unrollAsyncIterator(fetcher.fetchReviews(asin, { max: 5 }));

        expect(curly.get).toBeCalledWith(
            productReviewUrl(asin, 1),
            expect.objectContaining({
                httpHeader: expect.arrayContaining(headers),
            })
        );

        expect(browserHeaderProvider.get).toBeCalledTimes(1);
    });
});

describe('proxy aware product review fetcher', () => {
    it('rotates proxies', async () => {
        const asin = '1234567890';
        const httpClient = setupCurly();
        const proxyManagerClient = setupProxyManagerClient();
        const limiter = setupLimiter();
        const agents = [
            {auth: {}, listen: {host: 'a', port: 22}},
            {auth: {}, listen: {host: 'b', port: 22}},
            {auth: {}, listen: {host: 'c', port: 22}},
        ];

        for (const agent of agents) {
            proxyManagerClient.getNextSocksConnectionInfo.mockReturnValueOnce(agent);
        }

        httpClient.get.mockReturnValue({
            data: fs.readFileSync('fixtures/amazon/product-reviews.html').toString(),
        });

        const fetcher = new ProxyAwareProductReviewFetcher(
            httpClient,
            setupBrowserHeaderProvider(),
            proxyManagerClient,
            limiter
        );

        const reviews = await unrollAsyncIterator(fetcher.fetchReviews(asin, { max: 25 }));

        expect(httpClient.get.mock.calls).toEqual([
            [productReviewUrl(asin, 1), curlOptionsExpect],
            [productReviewUrl(asin, 2), curlOptionsExpect],
            [productReviewUrl(asin, 3), curlOptionsExpect],
        ]);

        expect(proxyManagerClient.getNextSocksConnectionInfo).toBeCalledTimes(3);

        for (const agent of agents) {
            expect(httpClient.get).toBeCalledWith(
                expect.anything(),
                expect.objectContaining({
                    proxy: `socks5://${agent.listen.host}:${agent.listen.port}`,
                }),
            );
        }

        expect(reviews).toHaveLength(25);
    });

    it('penalizes proxies on bot detection', async () => {
        const asin = '1234567890';
        const httpClient = setupCurly();
        const proxyManagerClient = setupProxyManagerClient();
        const limiter = setupLimiter();
        const agents = [
            {auth: {}, listen: {host: 'a'}},
            {auth: {}, listen: {host: 'b'}},
        ];

        for (const agent of agents) {
            proxyManagerClient.getNextSocksConnectionInfo.mockReturnValueOnce(agent);
        }

        httpClient.defaults = {headers: {foo: 'default'}};
        httpClient.get.mockReturnValueOnce({
            data: fs.readFileSync('fixtures/amazon/bot.html').toString(),
        });

        httpClient.get.mockReturnValue({
            data: fs.readFileSync('fixtures/amazon/product-reviews.html').toString(),
        });

        const fetcher = new ProxyAwareProductReviewFetcher(
            httpClient,
            setupBrowserHeaderProvider(),
            proxyManagerClient,
            limiter
        );
        const reviews = await unrollAsyncIterator(fetcher.fetchReviews(asin, { max: 5 }));

        expect(httpClient.get.mock.calls).toEqual([
            [productReviewUrl(asin, 1), curlOptionsExpect],
            [productReviewUrl(asin, 1), curlOptionsExpect],
        ]);

        expect(proxyManagerClient.getNextSocksConnectionInfo).toBeCalledTimes(2);
        expect(proxyManagerClient.reportBlockedRequest).toBeCalledWith(agents[0]);

        expect(reviews).toHaveLength(5);
    });

    function setupProxyManagerClient() {
        return {
            getNextSocksConnectionInfo: jest.fn(),
            reportBlockedRequest: jest.fn(),
        };
    }

    function setupLimiter() {
        return {
            schedule: jest.fn(),
        };
    }
});

function setupCurly() {
    return {
        get: jest.fn(),
    };
}

function setupBrowserHeaderProvider() {
    return {
        get: jest.fn().mockReturnValue([]),
    };
}
