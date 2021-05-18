const { SocksProxyManagerClient } = require("./client");
const { SocksProxyAgent } = require('socks-proxy-agent');

jest.mock('socks-proxy-agent');

describe('socks proxy manager client', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    const socksAuthOptions = {username: 'foo', password: 'bar'};
    const clientOptions = {auth: socksAuthOptions};

    it('fetches socks connection infos', async () => {
        const storage = setupStorage();
        const listen = {host: 'foobar', port: 23};
        storage.getLRUConnection.mockReturnValueOnce({
            listen,
            connectionConfigHash: 'cch'
        });

        const client = new SocksProxyManagerClient(clientOptions, storage);
        const sci = await client.getNextSocksConnectionInfo();

        expect(sci).toBeDefined();
        expect(sci).toMatchObject({
            listen,
            auth: socksAuthOptions,
        });
    });

    it('will return undefined if the storage doesnt have a connection', async () => {
        const storage = setupStorage();
        storage.getLRUConnection.mockReturnValueOnce(undefined);

        const client = new SocksProxyManagerClient(clientOptions, storage);
        const sci = await client.getNextSocksConnectionInfo();

        expect(sci).not.toBeDefined();
    });

    it('report blocked requests will be applied to the correct connection', async () => {
        const storage = setupStorage();
        storage.getLRUConnection.mockReturnValueOnce({
            listen: {host: 'foobar', port: 23},
            connectionConfigHash: 'cch',
        });

        const client = new SocksProxyManagerClient(clientOptions, storage);
        const sci = await client.getNextSocksConnectionInfo();
        await client.reportBlockedRequest(sci);

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
