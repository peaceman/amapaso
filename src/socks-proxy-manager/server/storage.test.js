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

    function setupRedis() {
        return {
            expire: jest.fn(),
            set: jest.fn(),
            zadd: jest.fn(),
            expire: jest.fn(),
        };
    }
});
