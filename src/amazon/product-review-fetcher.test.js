const fs = require('fs');
const { ProductReviewFetcher } = require("./product-review-fetcher");
const { unrollAsyncIterator } = require('../utils');

describe('product review fetcher', () => {
    it('fetches reviews', async () => {
        const asin = '1234567890';
        const axios = setupAxios();
        axios.get.mockReturnValueOnce({
            data: fs.readFileSync('fixtures/amazon/product-reviews.html').toString(),
        });

        const fetcher = new ProductReviewFetcher(axios);
        const reviews = await unrollAsyncIterator(fetcher.fetchReviews(asin));

        expect(axios.get)
            .toBeCalledWith(`https://www.amazon.de/product-reviews/${asin}/?ie=UTF8&pageNumber=1`);

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
        const axios = setupAxios();
        axios.get.mockReturnValue({
            data: fs.readFileSync('fixtures/amazon/product-reviews.html').toString(),
        });

        const fetcher = new ProductReviewFetcher(axios);
        const reviews = await unrollAsyncIterator(fetcher.fetchReviews(asin, { max: 25 }));

        expect(axios.get.mock.calls).toEqual([
            [`https://www.amazon.de/product-reviews/${asin}/?ie=UTF8&pageNumber=1`],
            [`https://www.amazon.de/product-reviews/${asin}/?ie=UTF8&pageNumber=2`],
            [`https://www.amazon.de/product-reviews/${asin}/?ie=UTF8&pageNumber=3`],
        ]);

        expect(reviews).toHaveLength(25);
    });

    it('retries failed requests', async () => {
        const asin = '1234567890';
        const axios = setupAxios();
        axios.get.mockImplementationOnce(() => {
            throw new Error('hi');
        });

        axios.get.mockReturnValue({
            data: fs.readFileSync('fixtures/amazon/product-reviews.html').toString(),
        });

        const fetcher = new ProductReviewFetcher(axios);
        const reviews = await unrollAsyncIterator(fetcher.fetchReviews(asin, { max: 5 }));

        expect(axios.get.mock.calls).toEqual([
            [`https://www.amazon.de/product-reviews/${asin}/?ie=UTF8&pageNumber=1`],
            [`https://www.amazon.de/product-reviews/${asin}/?ie=UTF8&pageNumber=1`],
        ]);

        expect(reviews).toHaveLength(5);
    });

    it('detects captcha', async () => {
        const asin = '1234567890';
        const axios = setupAxios();
        axios.get.mockReturnValueOnce({
            data: fs.readFileSync('fixtures/amazon/bot.html').toString(),
        });

        axios.get.mockReturnValue({
            data: fs.readFileSync('fixtures/amazon/product-reviews.html').toString(),
        });

        const fetcher = new ProductReviewFetcher(axios);
        const reviews = await unrollAsyncIterator(fetcher.fetchReviews(asin, { max: 5 }));

        expect(axios.get.mock.calls).toEqual([
            [`https://www.amazon.de/product-reviews/${asin}/?ie=UTF8&pageNumber=1`],
            [`https://www.amazon.de/product-reviews/${asin}/?ie=UTF8&pageNumber=1`],
        ]);

        expect(reviews).toHaveLength(5);
    });

    function setupAxios() {
        return {
            get: jest.fn(),
        };
    }
});
