async function unrollAsyncIterator(iter) {
    const values = [];

    for await (const v of iter) {
        values.push(v);
    }

    return values;
}

module.exports = {
    unrollAsyncIterator,
};
