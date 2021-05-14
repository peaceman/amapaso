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
     * @param {string} productAsin
     * @param {FetchReviewOptions} options
     * @yields {ProductReviewData}
     */
    async * fetchReviews(productAsin, { max = 10 } = {}) {
        yield* [];
    }
}

module.exports = {
    ProductReviewFetcher,
};
