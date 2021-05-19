const cheerio = require('cheerio');
const log = require('../log');
const { parse } = require('date-fns');
const de = require('date-fns/locale/de');
const pRetry = require('p-retry');
const { SocksProxyManagerClient } = require('../socks-proxy-manager/client');
const Bottleneck = require('bottleneck');
const { curly } = require('node-libcurl');

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
     * @param {curly} curly
     */
    constructor(curly, browserHeaderProvider = []) {
        /** @type {curly} */
        this.curly = curly;
        /** @type {BrowserHeaderProvider} */
        this.browserHeaderProvider = browserHeaderProvider;
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
        log.info('Fetch reviews from page', {
            productAsin,
            pageNr,
        });

        const url = productReviewUrl(productAsin, pageNr);

        const html = await pRetry(
            () => this.loadPageHtml(url, {
                httpHeader: [`Referer: ${productUrl(productAsin)}`],
            }),
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

        log.info('Loaded product review page', {productAsin, pageNr});

        const $ = cheerio.load(html);
        const reviewEls = $('div[data-hook="review"]');

        return reviewEls
            .map((k, v) => extractReview($, v))
            .get()
            .filter(v => Boolean(v));
    }

    /**
     * @param {string} url
     * @param {Object} curlOptions
     * @returns {string}
     */
    async loadPageHtml(url, curlOptions = {}) {
        log.info('Load product review page', {
            url,
        });

        const browserHeaders = await this.getRandomBrowserHeaders();
        log.info('Randomized browser headers', browserHeaders);

        const options = {
            ...curlOptions,
            httpHeader: browserHeaders.concat(curlOptions.httpHeader || []),
            acceptEncoding: '', // accept all encodings that curl supports
        };

        return '';
        const { statusCode, data, headers } = await this.curly.get(url, options);

        if (data.includes('errors/validateCaptcha')) {
            throw new BotDetectionError(options);
        }

        return data;
    }

    async getRandomBrowserHeaders() {
        return await this.browserHeaderProvider.get();
    }
}

class BotDetectionError extends Error {
    constructor(curlOptions) {
        super('Bot detected');

        this.curlOptions = curlOptions;
    }
}

class ProxyAwareProductReviewFetcher extends ProductReviewFetcher {
    /**
     * @param {curly} curly
     * @param {Array<Array<String>>} headers
     * @param {SocksProxyManagerClient} proxyManagerClient
     * @param {Bottleneck} limiter
     */
     constructor(curly, headers, proxyManagerClient, limiter) {
        super(curly, headers);

        /** @type {SocksProxyManagerClient} */
        this.proxyManagerClient = proxyManagerClient;

        /** @type {Bottleneck} */
        this.limiter = limiter;
    }

    /**
     * @param {string} url
     * @param {Object} curlOptions
     * @returns {string}
     */
     async loadPageHtml(url, curlOptions = {}) {
        await this.limiter.schedule(() => ({}));
        const sci = await this.proxyManagerClient.getNextSocksConnectionInfo();

        const curlProxyAuthOptions = sci.auth.username !== undefined && sci.auth.password !== undefined
            ? { proxyUsername: sci.auth.username, proxyPassword: sci.auth.password }
            : {};

        if (sci === undefined) {
            throw new MissingSocksConnectionInfoError();
        }

        try {
            return await super.loadPageHtml(url, {
                proxy: `socks5://${sci.listen.host}:${sci.listen.port}`,
                ...curlProxyAuthOptions,
                ...curlOptions,
            });
        } catch (e) {
            if (e instanceof BotDetectionError) {
                log.warn('Bot detection error', {err: e});
                await this.proxyManagerClient.reportBlockedRequest(sci);
            }

            throw e;
        }
    }
}

class MissingSocksConnectionInfoError extends Error {
    constructor() {
        super('Missing http agents for next request');
    }
}

/**
 * @param {string} asin
 * @param {number} pageNr
 */
function productReviewUrl(asin, pageNr) {
    return `https://www.amazon.de/product-reviews/${asin}/ref=cm_cr_dp_d_show_all_btm?ie=UTF8&pageNumber=${pageNr}&reviewerType=all_reviews`;
}

function productUrl(asin) {
    return `https://www.amazon.de/dp/${asin}`;
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
    const match = string.match(/.+(?:vom|am)\s(.+)$/);
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
    productReviewUrl,
    ProductReviewFetcher,
    ProxyAwareProductReviewFetcher,
};
