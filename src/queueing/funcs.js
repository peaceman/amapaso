const { Queue, QueueScheduler, Worker, Job } = require('bullmq');
const config = require('config');
const log = require('../log');
const { QUEUE_NAME, JOBS} = require('./meta');

function createQueue() {
    const queue = new Queue(QUEUE_NAME, {
        connection: config.get('redis.connectionUrl'),
        defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 100,
        },
    });

    queue.waitUntilReady()
        .then(() => log.info('Connected queue', {queueName: QUEUE_NAME}));

    return queue;
}

function createQueueScheduler() {
    const scheduler = new QueueScheduler(QUEUE_NAME, {
        connection: config.get('redis.connectionUrl'),
    });

    scheduler.waitUntilReady()
        .then(() => log.info('Connected queue scheduler', {queueName: QUEUE_NAME}));

    return scheduler;
}

function createWorker() {
    const worker = new Worker(
        QUEUE_NAME,
        workerProcess,
        {
            connection: config.get('redis.connectionUrl'),
            concurrency: 50,
        }
    );

    worker.on('error', error => {
        log.error('Worker error', {error});
    });

    worker.waitUntilReady()
        .then(() => log.info('Connected queue worker', {queueName: QUEUE_NAME}));

    return worker;
}

/**
 * @param {Queue} queue
 */
async function addScheduledJobs(queue) {
    await queue.add(JOBS.QUEUE_IMPORT_CATEGORY_PRODUCTS, {}, {
        repeat: {
            every: 2 * 60 * 1000,
        },
    });
}

/**
 * @param {Job} job
 */
async function workerProcess(job) {
    log.info('what is dis', {name: job.name, data: job.data});

    switch (job.name) {
        case JOBS.QUEUE_IMPORT_CATEGORY_PRODUCTS:
            await handleQueueImportCategoryProducts(job);
            break;
        case JOBS.IMPORT_CATEGORY_PRODUCTS:
            await handleImportCategoryProducts(job);
            break;
        default:
            log.warn('Worker received a job but has no handler for it', {job: {
                name: job.name, id: job.id
            }});
    }
}

/**
 * @param {Job} job
 */
async function handleQueueImportCategoryProducts(job) {
    const { queueImportCategoryProducts } = require('../import/product');
    await queueImportCategoryProducts.execute();
}

/**
 * @param {Job} job
 */
async function handleImportCategoryProducts(job) {
    const { importCategoryProducts } = require('../import/product');
    await importCategoryProducts.execute(job.data);
}

module.exports = {
    createQueue,
    createQueueScheduler,
    createWorker,
    addScheduledJobs,
};
