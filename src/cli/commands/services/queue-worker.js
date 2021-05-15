const { createQueue, createQueueScheduler, createWorker, addScheduledJobs } = require("../../../queueing/funcs");
const log = require('../../../log');

exports.command = 'queue-worker';
exports.describe = 'starts the queue worker';
exports.handler = async argv => {
    log.info('Starting queue');
    const queue = await createQueue();

    log.info('Starting queue scheduler');
    const scheduler = await createQueueScheduler();

    log.info('Add scheduled jobs');
    addScheduledJobs(queue);

    log.info('Starting queue worker');
    const worker = await createWorker();
};
