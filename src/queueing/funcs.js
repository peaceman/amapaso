const { Queue, QueueScheduler, Worker, Job } = require('bullmq');
const Redis = require('ioredis');
const config = require('config');
const log = require('../log');
const { QUEUE_NAME, JOBS} = require('./meta');

function redisConnection() {
    return new Redis(config.get('redis.connectionUrl'));
}

function createQueue() {
    const queue = new Queue(QUEUE_NAME, {
        connection: redisConnection(),
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
        connection: redisConnection(),
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
            connection: redisConnection(),
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

    await queue.add(JOBS.QUEUE_IMPORT_PRODUCT_REVIEWS, {}, {
        repeat: {
            every: 30 * 1000,
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
        case JOBS.QUEUE_IMPORT_PRODUCT_REVIEWS:
            await handleQueueImportProductReviews(job);
            break;
        case JOBS.IMPORT_PRODUCT_REVIEWS:
            await handleImportProductReviews(job);
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

/**
 * @param {Job} job
 */
async function handleQueueImportProductReviews(job) {
    const { queueImportProductReviews } = require('../import/product');
    await queueImportProductReviews.execute();
}

/**
 * @param {Job} job
 */
async function handleImportProductReviews(job) {
    const { importProductReviews } = require('../import/product');
    await importProductReviews.execute(job.data);
}

module.exports = {
    createQueue,
    createQueueScheduler,
    createWorker,
    addScheduledJobs,
};
