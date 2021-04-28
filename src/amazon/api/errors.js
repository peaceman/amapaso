class TooManyRequestsError extends Error {
    constructor(previous) {
        super('Too many requests');

        this.previous = previous;
    }
}

module.exports = {
    TooManyRequestsError,
};
