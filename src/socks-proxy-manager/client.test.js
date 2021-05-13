const { SocksProxyManagerClient } = require("./client");
const { SocksProxyAgent } = require('socks-proxy-agent');

jest.mock('socks-proxy-agent');

describe('socks proxy manager client', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    const socksAuthOptions = {username: 'foo', password: 'bar'};
    const clientOptions = {auth: socksAuthOptions};

    it('fetches http agents', async () => {
        const storage = setupStorage();
        const listen = {host: 'foobar', port: 23};
        storage.getLRUConnection.mockReturnValueOnce({
            listen,
            connectionConfigHash: 'cch'
        });

        const client = new SocksProxyManagerClient(clientOptions, storage);
        const agents = await client.getNextHttpAgents();

        expect(agents).toBeDefined();
        expect(agents).toMatchObject({
            httpAgent: expect.any(SocksProxyAgent),
            httpsAgent: expect.any(SocksProxyAgent),
        });

        const socksConfig = {
            ...listen,
            userId: socksAuthOptions.username,
            password: socksAuthOptions.password,
        };

        expect(SocksProxyAgent).toHaveBeenCalledWith(socksConfig);
        expect(SocksProxyAgent).toHaveBeenCalledWith(socksConfig);
    });

    it('will return undefined if the storage doesnt have a connection', async () => {
        const storage = setupStorage();
        storage.getLRUConnection.mockReturnValueOnce(undefined);

        const client = new SocksProxyManagerClient(clientOptions, storage);
        const agents = await client.getNextHttpAgents();

        expect(agents).not.toBeDefined();
    });

    it('report blocked requests will be applied to the correct connection', async () => {
        const storage = setupStorage();
        storage.getLRUConnection.mockReturnValueOnce({
            listen: {host: 'foobar', port: 23},
            connectionConfigHash: 'cch',
        });

        const client = new SocksProxyManagerClient(clientOptions, storage);
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
