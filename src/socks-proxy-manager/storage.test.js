const MockDate  = require('mockdate');
const { Storage } = require('./storage');

describe('storage', () => {

    afterEach(() => {
        MockDate.reset();
    });

    it('stores connections', async () => {
        const redis = setupRedis();
        const storage = new Storage(redis);

        const connectionConfigHash = 'config-hash';
        const listenerIdentifier = 'listener-identifier';
        const socksListenOptions = {foo: 'bar'};

        MockDate.set('2001-11-09');

        await storage.storeConnection(
            connectionConfigHash,
            listenerIdentifier,
            socksListenOptions
        );

        // listener options
        expect(redis.set).toHaveBeenCalledWith(
            `spm:listeners:${listenerIdentifier}`,
            JSON.stringify(socksListenOptions),
            'EX',
            10,
        );

        // listener <-> connection assignment
        expect(redis.zadd).toHaveBeenCalledWith(
            `spm:connections:${connectionConfigHash}`,
            'NX',
            Date.now(),
            listenerIdentifier
        );

        // connection
        expect(redis.zadd).toHaveBeenCalledWith(
            `spm:connections`,
            'NX',
            Date.now(),
            connectionConfigHash
        );
    });

    it('refreshes listeners', async () => {
        const redis = setupRedis();
        const storage = new Storage(redis);

        const listenerIdentifier = 'listener-identifier';

        await storage.refreshListener(listenerIdentifier);

        expect(redis.expire).toHaveBeenCalledWith(
            `spm:listeners:${listenerIdentifier}`,
            10
        );
    });

    it('removes listeners', async () => {
        const redis = setupRedis();
        const storage = new Storage(redis);

        const listenerIdentifier = 'listener-identifier';

        await storage.removeListener(listenerIdentifier);

        expect(redis.del).toHaveBeenCalledWith(
            `spm:listeners:${listenerIdentifier}`
        );
    });

    it('uses the configured expiry', async () => {
        const redis = setupRedis();

        const expiry = 23;
        const storage = new Storage(redis, {listenerExpiry: expiry});

        const connectionConfigHash = 'config-hash';
        const listenerIdentifier = 'listener-identifier';
        const socksListenOptions = {foo: 'bar'};

        await storage.storeConnection(
            connectionConfigHash,
            listenerIdentifier,
            socksListenOptions
        );

        // listener options
        expect(redis.set).toHaveBeenCalledWith(
            `spm:listeners:${listenerIdentifier}`,
            JSON.stringify(socksListenOptions),
            'EX',
            expiry,
        );

        await storage.refreshListener(listenerIdentifier);

        expect(redis.expire).toHaveBeenCalledWith(
            `spm:listeners:${listenerIdentifier}`,
            expiry
        );
    });

    describe('get lru connection', () => {
        it('gets a connection', async () => {
            MockDate.set('2001-11-09');

            const redis = setupRedis();
            const storage = new Storage(redis);

            const connectionConfigHash = 'cch';
            const listenerIdentifier = 'lid';
            const listenOptions = {host: 'foobar', port: 23};

            redis.zrange
                .mockReturnValueOnce([connectionConfigHash])
                .mockReturnValueOnce([listenerIdentifier]);

            redis.get
                .mockReturnValueOnce(JSON.stringify(listenOptions));

            const connection = await storage.getLRUConnection();

            expect(connection).toBeDefined();
            expect(connection).toEqual({
                listen: listenOptions,
                connectionConfigHash,
            });
            expect(redis.zrange).toHaveBeenCalledWith(`spm:connections`, 0, 1);
            expect(redis.zadd)
                .toHaveBeenCalledWith(`spm:connections`, 'GT', Date.now(), connectionConfigHash);
            expect(redis.zrange)
                .toHaveBeenCalledWith(`spm:connections:${connectionConfigHash}`, 0, 1);

            expect(redis.zadd)
                .toHaveBeenCalledWith(
                    `spm:connections:${connectionConfigHash}`,
                    'GT',
                    Date.now(),
                    listenerIdentifier
                );
            expect(redis.get).toHaveBeenCalledWith(`spm:listeners:${listenerIdentifier}`);
        });

        it('updates scores', async () => {
            MockDate.set('2001-11-09');

            const redis = setupRedis();
            const storage = new Storage(redis);

            const connectionConfigHash = 'cch';
            const listenerIdentifier = 'lid';
            const listenOptions = {host: 'foobar', port: 23};

            redis.zrange
                .mockReturnValueOnce([connectionConfigHash])
                .mockReturnValueOnce([listenerIdentifier]);

            redis.get
                .mockReturnValueOnce(JSON.stringify(listenOptions));

            const connection = await storage.getLRUConnection();

            expect(redis.zadd)
                .toHaveBeenCalledWith(`spm:connections`, 'GT', Date.now(), connectionConfigHash);

            expect(redis.zadd)
                .toHaveBeenCalledWith(
                    `spm:connections:${connectionConfigHash}`,
                    'GT',
                    Date.now(),
                    listenerIdentifier
                );
        });

        it('removes non existent listeners from the sorted set', async () => {
            const redis = setupRedis();
            const storage = new Storage(redis);

            const connectionConfigHash = 'cch';
            const listenerIdentifier = 'lid';

            redis.zrange
                .mockReturnValueOnce([connectionConfigHash])
                .mockReturnValueOnce([listenerIdentifier]);

            redis.get
                .mockReturnValueOnce(null);

            const connection = await storage.getLRUConnection();
            expect(connection).not.toBeDefined();

            expect(redis.zrem)
                .toHaveBeenCalledWith(`spm:connections:${connectionConfigHash}`, listenerIdentifier);
        });

        it('removes non existent or empty connections from the sorted set', async () => {
            const redis = setupRedis();
            const storage = new Storage(redis);

            const connectionConfigHash = 'cch';

            redis.zrange
                .mockReturnValueOnce([connectionConfigHash])
                .mockReturnValueOnce([]);

            redis.get
                .mockReturnValue(null);

            const connection = await storage.getLRUConnection();
            expect(connection).not.toBeDefined();

            expect(redis.zrem)
                .toHaveBeenCalledWith(`spm:connections`, connectionConfigHash);
        });

        it('returns undefined if there are no connections', async () => {
            const redis = setupRedis();
            const storage = new Storage(redis);

            const connectionConfigHash = 'cch';

            redis.zrange
                .mockReturnValueOnce([]);

            const connection = await storage.getLRUConnection();

            expect(connection).not.toBeDefined();
        });

        it('returns undefined if there are no listeners', async () => {
            const redis = setupRedis();
            const storage = new Storage(redis);

            const connectionConfigHash = 'cch';

            redis.zrange
                .mockReturnValueOnce([connectionConfigHash])
                .mockReturnValueOnce([]);

            const connection = await storage.getLRUConnection();

            expect(connection).not.toBeDefined();

            expect(redis.get).toHaveBeenCalledTimes(0);
            expect(redis.zadd).not
                .toHaveBeenCalledWith(
                    `spm:connections:${connectionConfigHash}`,
                    'GT',
                    Date.now(),
                    undefined
                );
        });

        it('returns undefined on errors', async () => {
            const redis = setupRedis();
            const storage = new Storage(redis);

            const connectionConfigHash = 'cch';

            redis.zrange
                .mockImplementationOnce(() => {
                    throw new Error('hi')
                });

            const connection = await storage.getLRUConnection();

            expect(connection).not.toBeDefined();
        });
    });

    function setupRedis() {
        return {
            expire: jest.fn(),
            set: jest.fn(),
            zadd: jest.fn(),
            expire: jest.fn(),
            del: jest.fn(),
            zrange: jest.fn(),
            get: jest.fn(),
            zrem: jest.fn(),
        };
    }
});
