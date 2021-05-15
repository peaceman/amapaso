const axios = require('axios');
const cheerio = require('cheerio');
const log = require('../log');
const { parse } = require('date-fns');
const de = require('date-fns/locale/de');
const pRetry = require('p-retry');
const { SocksProxyManagerClient } = require('../socks-proxy-manager/client');
const mergeConfig = require('axios/lib/core/mergeConfig');

/**
 * @typedef {Object} ProductReviewData
 * @property {string} id
 * @property {string} name
 * @property {string} title
 * @property {number} points
 * @property {string} content
 * @property {Date} date
 */

/**
 * @typedef {Object} FetchReviewOptions
 * @property {number} max Max amount of reviews to fetch
 */

class ProductReviewFetcher {
    /**
     * @param {axios.AxiosInstance} axios
     */
    constructor(axios) {
        /** @type {axios.AxiosInstance} */
        this.axios = axios;
    }

    /**
     * @param {string} productAsin
     * @param {FetchReviewOptions} options
     * @yields {ProductReviewData}
     */
    async * fetchReviews(productAsin, { max = 10 } = {}) {
        let counter = 0;

        for (let page = 1;; page++) {
            const reviews = await this.fetchReviewsFromPage(productAsin, page);
            if (reviews.length === 0) {
                return;
            }

            yield* reviews.slice(0, max - counter);
            counter += reviews.length;

            if (counter >= max) {
                return;
            }
        }
    }

    /**
     * @param {string} productAsin
     * @param {number} pageNr
     * @returns {Array<ProductReviewData>}
     */
    async fetchReviewsFromPage(productAsin, pageNr) {
        const url = productReviewUrl(productAsin, pageNr);

        const html = await pRetry(
            () => this.loadPageHtml(url),
            {
                onFailedAttempt: error => {
                    log.warn('Failed to load product review page', {
                        productAsin,
                        url,
                        error,
                    });
                }
            }
        );

        const $ = cheerio.load(html);
        const reviewEls = $('div[data-hook="review"]');

        return reviewEls
            .map((k, v) => extractReview($, v))
            .get()
            .filter(v => Boolean(v));
    }

    /**
     * @param {string} url
     * @returns {string}
     */
    async loadPageHtml(url) {
        const response = await this.axios.get(url);
        const html = response.data;

        if (html.includes('errors/validateCaptcha')) {
            throw new BotDetectionError();
        }

        return html;
    }
}

class BotDetectionError extends Error {
    constructor() {
        super('Bot detected')
    }
}

class ProxyAwareProductReviewFetcher extends ProductReviewFetcher {
    /**
     * @param {axios.AxiosInstance} axios
     * @param {SocksProxyManagerClient} proxyManagerClient
     */
     constructor(axios, proxyManagerClient) {
        super(axios);

        /** @type {SocksProxyManagerClient} */
        this.proxyManagerClient = proxyManagerClient;
    }

    /**
     * @param {string} url
     * @returns {string}
     */
     async loadPageHtml(url) {
        const previousAxios = this.axios;
        const agents = await this.proxyManagerClient.getNextHttpAgents();
        if (agents === undefined) {
            throw new MissingHttpAgentsError();
        }

        this.axios = axios.create(mergeConfig(previousAxios.defaults, agents));

        try {
            return await super.loadPageHtml(url);
        } catch (e) {
            if (e instanceof BotDetectionError) {
                await this.proxyManagerClient.reportBlockedRequest(agents);
            }

            throw e;
        } finally {
            this.axios = previousAxios;
        }
    }
}

class MissingHttpAgentsError extends Error {
    constructor() {
        super('Missing http agents for next request');
    }
}

/**
 * @param {string} asin
 * @param {number} pageNr
 */
function productReviewUrl(asin, pageNr) {
    return `https://www.amazon.de/product-reviews/${asin}/?ie=UTF8&pageNumber=${pageNr}`;
}

/**
 * @param {cheerio.Node} node
 * @returns {ProducReviewData|undefined}
 */
function extractReview($, node) {
    return {
        id: $(node).attr('id'),
        title: $(node).find('[data-hook="review-title"]').first().text().trim(),
        name: $(node).find('span.a-profile-name').first().text().trim(),
        points: parseReviewRating($(node).find('[data-hook="review-star-rating"]').first().text().trim()),
        date: parseReviewDate($(node).find('[data-hook="review-date"]').first().text().trim()),
        content: parseReviewContent($(node).find('[data-hook="review-body"] > span').first().html().trim()),
    };
}

/**
 * @param {string} rating
 * @returns {number}
 */
function parseReviewRating(rating, { defaultRating = 1 } = {}) {
    const [nr] = rating.split(' ', 1);
    if (nr === undefined) return defaultRating;

    const float = parseFloat(nr.replace(',', '.'));

    return isNaN(float) ? defaultRating : float;
}

/**
 * @param {string} string
 * @returns {Date}
 */
function parseReviewDate(string) {
    const match = string.match(/.+vom\s(.+)$/);
    // const date = new Date(match === null ? undefined : match[1]);
    const date = parse(
        match === null ? undefined : match[1],
        'd. MMMM y',
        new Date(),
        { locale: de }
    );

    if (!isValidDate(date)) {
        log.warn('Failed to parse review date', {
            date: string,
        });

        return new Date();
    }

    return date;
}

/**
 * @param {Date} date
 * @returns {bool}
 */
function isValidDate(date) {
    return date instanceof Date
        && !isNaN(date);
}

/**
 * @param {string} content
 * @returns {string}
 */
function parseReviewContent(content) {
    return content.replace(/<br\s*\/?>/, "\n");
}

module.exports = {
    ProductReviewFetcher,
    ProxyAwareProductReviewFetcher,
};
