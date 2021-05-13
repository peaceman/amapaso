const { SocksProxyManagerClient } = require("./client");
const socks = require('socksv5');

jest.mock('socksv5');

describe('socks proxy manager client', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('fetches http agents', async () => {
        const storage = setupStorage();
        const listen = {host: 'foobar', port: 23};
        storage.getLRUConnection.mockReturnValueOnce({
            listen,
            connectionConfigHash: 'cch'
        });

        const client = new SocksProxyManagerClient(storage);
        const agents = await client.getNextHttpAgents();

        expect(agents).toBeDefined();
        expect(agents).toMatchObject({
            httpAgent: expect.any(socks.HttpAgent),
            httpsAgent: expect.any(socks.HttpsAgent),
        });

        expect(socks.HttpAgent).toHaveBeenCalledWith(listen);
        expect(socks.HttpsAgent).toHaveBeenCalledWith(listen);
    });

    it('will return undefined if the storage doesnt have a connection', async () => {
        const storage = setupStorage();
        storage.getLRUConnection.mockReturnValueOnce(undefined);

        const client = new SocksProxyManagerClient(storage);
        const agents = await client.getNextHttpAgents();

        expect(agents).not.toBeDefined();
    });

    it('report blocked requests will be applied to the correct connection', async () => {
        const storage = setupStorage();
        storage.getLRUConnection.mockReturnValueOnce({
            listen: {host: 'foobar', port: 23},
            connectionConfigHash: 'cch',
        });

        const client = new SocksProxyManagerClient(storage);
        const agents = await client.getNextHttpAgents();
        await client.reportBlockedRequest(agents);

        expect(storage.penalizeConnection).toHaveBeenCalledWith('cch');
    });

    function setupStorage() {
        return {
            storeConnection: jest.fn(),
            refreshListener: jest.fn(),
            removeListener: jest.fn(),
            getLRUConnection: jest.fn(),
            penalizeConnection: jest.fn(),
        };
    }
});
