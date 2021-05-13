
const { SocksProxyManagerServer } = require('./server');
const ssh = require('./ssh');
const socks = require('./socks');
const EventEmitter = require('events');
const crypto = require('crypto');
const { tap } = require('lodash');
jest.mock('./ssh');
        jest.mock('./socks');


describe('socks proxy manager server', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    const proxyManagerOptions = {
        socks: {
            listen: {
                host: 'localhost',
            },
        },
        ssh: {
            connections: [
                {
                    host: 'foobar',
                    username: 'magician',
                },
            ],
        },
    };

    it('opens connections', async () => {
        const storage = setupStorage();
        const sshConnection = setupSshConnection();
        ssh.openSshConnection.mockReturnValueOnce(sshConnection);

        const socksServer = setupSocksServer();
        socks.openSocksServer.mockReturnValueOnce(socksServer);
        socksServer.address.mockReturnValueOnce({port: 44});

        // exec
        const server = new SocksProxyManagerServer(proxyManagerOptions, storage);
        await server.start({watch: false});

        // assertions
        expect(socks.openSocksServer).toHaveBeenCalledWith(
            proxyManagerOptions.socks.listen.host,
            proxyManagerOptions.socks.auth,
        );

        expect(ssh.openSshConnection).toHaveBeenCalledWith(proxyManagerOptions.ssh.connections[0]);
        expect(storage.storeConnection).toHaveBeenCalledWith(
            crypto.createHash('md5')
                .update(JSON.stringify(proxyManagerOptions.ssh.connections[0]))
                .digest('hex'),
            expect.any(String),
            {...proxyManagerOptions.socks.listen, port: 44}
        );
    });

    it('refreshes listeners', async () => {
        const storage = setupStorage();
        const sshConnection = setupSshConnection();
        ssh.openSshConnection.mockReturnValueOnce(sshConnection);

        const socksServer = setupSocksServer();
        socks.openSocksServer.mockReturnValueOnce(socksServer);
        socksServer.address.mockReturnValueOnce({port: 44});

        storage.refreshListener.mockResolvedValue();

        jest.useFakeTimers();

        // exec
        const server = new SocksProxyManagerServer(proxyManagerOptions, storage);
        await server.start({watch: false});

        // assertions
        expect(storage.refreshListener).toHaveBeenCalledTimes(0);

        jest.advanceTimersByTime(10 * 1000);
        expect(storage.refreshListener).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(10 * 1000);
        expect(storage.refreshListener).toHaveBeenCalledTimes(2);
    });

    it('stops refreshing listeners after connection closing', async () => {
        const storage = setupStorage();
        const sshConnection = setupSshConnection();
        ssh.openSshConnection.mockReturnValueOnce(sshConnection);

        const socksServer = setupSocksServer();
        socks.openSocksServer.mockReturnValueOnce(socksServer);
        socksServer.address.mockReturnValueOnce({port: 44});

        storage.refreshListener.mockReturnValue(Promise.resolve());

        jest.useFakeTimers();

        // exec
        const server = new SocksProxyManagerServer(proxyManagerOptions, storage);
        await server.start({watch: false});

        // assertions
        expect(storage.refreshListener).toHaveBeenCalledTimes(0);

        jest.advanceTimersByTime(10 * 1000);
        expect(storage.refreshListener).toHaveBeenCalledTimes(1);

        sshConnection.emit('close');
        await server.waitForClosedConnection();

        jest.advanceTimersByTime(10 * 1000);

        expect(storage.refreshListener).toHaveBeenCalledTimes(1);
    });

    it('closes socks server after ssh connection closing', async () => {
        const storage = setupStorage();
        const sshConnection = setupSshConnection();
        ssh.openSshConnection.mockReturnValueOnce(sshConnection);

        const socksServer = setupSocksServer();
        socks.openSocksServer.mockReturnValueOnce(socksServer);
        socksServer.address.mockReturnValueOnce({port: 44});

        storage.refreshListener.mockReturnValue(Promise.resolve());

        jest.useFakeTimers();

        // exec
        const server = new SocksProxyManagerServer(proxyManagerOptions, storage);
        await server.start({watch: false});

        // assertions

        sshConnection.emit('close');
        await server.waitForClosedConnection();

        expect(socksServer.close).toHaveBeenCalled();
    });

    it('removes listener from storage after connection closing', async () => {
        const storage = setupStorage();
        const sshConnection = setupSshConnection();

        ssh.openSshConnection.mockReturnValueOnce(sshConnection);

        const socksServer = setupSocksServer();
        socksServer.close.mockImplementation(function () { this.emit('close'); });
        socks.openSocksServer.mockReturnValueOnce(socksServer);
        socksServer.address.mockReturnValueOnce({port: 44});

        storage.refreshListener.mockReturnValue(Promise.resolve());

        jest.useFakeTimers();

        // exec
        const server = new SocksProxyManagerServer(proxyManagerOptions, storage);
        await server.start({watch: false});

        // assertions

        sshConnection.emit('close');
        await server.waitForClosedConnection();

        expect(storage.removeListener).toHaveBeenCalledWith(expect.any(String));
    });

    it('closes ssh connection after ssh connection error', async () => {
        const storage = setupStorage();
        const sshConnection = setupSshConnection();
        ssh.openSshConnection.mockReturnValueOnce(sshConnection);

        const socksServer = setupSocksServer();
        socks.openSocksServer.mockReturnValueOnce(socksServer);
        socksServer.address.mockReturnValueOnce({port: 44});

        storage.refreshListener.mockReturnValue(Promise.resolve());

        jest.useFakeTimers();

        // exec
        const server = new SocksProxyManagerServer(proxyManagerOptions, storage);
        await server.start({watch: false});

        // assertions
        sshConnection.emit('error');
        await server.waitForClosedConnection();

        expect(sshConnection.end).toHaveBeenCalled();
    });

    it('closes ssh connection after socks server creation failure', async () => {
        const storage = setupStorage();
        const sshConnection = setupSshConnection();
        ssh.openSshConnection.mockReturnValueOnce(sshConnection);

        const socksServer = setupSocksServer();
        socks.openSocksServer.mockReturnValueOnce(Promise.reject());

        storage.refreshListener.mockReturnValue(Promise.resolve());

        jest.useFakeTimers();

        // exec
        const server = new SocksProxyManagerServer(proxyManagerOptions, storage);
        await server.start({watch: false});

        // assertions
        await server.waitForClosedConnection();

        expect(sshConnection.end).toHaveBeenCalled();
    });

    it('reopens connection after error', async () => {
        const storage = setupStorage();
        const sshConnection = setupSshConnection();
        ssh.openSshConnection.mockReturnValue(sshConnection);

        socks.openSocksServer
            .mockReturnValueOnce(tap(
                setupSocksServer(),
                ss => ss.address.mockReturnValueOnce({port: 42})
            ));

        socks.openSocksServer
            .mockReturnValueOnce(tap(setupSocksServer(), ss => ss.address.mockReturnValueOnce({port: 23})));

        storage.refreshListener.mockResolvedValue();

        jest.useFakeTimers();

        // exec
        const server = new SocksProxyManagerServer(proxyManagerOptions, storage);
        await server.start({watch: false});

        // assertions
        sshConnection.emit('error');
        await server.reopenClosedConnection();

        expect(socks.openSocksServer).toHaveBeenCalledTimes(2);
        expect(socks.openSocksServer).toHaveBeenCalledWith(
            proxyManagerOptions.socks.listen.host,
            proxyManagerOptions.socks.auth,
        );

        expect(ssh.openSshConnection).toHaveBeenCalledTimes(2);
        expect(storage.storeConnection).toHaveBeenCalledWith(
            crypto.createHash('md5')
                .update(JSON.stringify(proxyManagerOptions.ssh.connections[0]))
                .digest('hex'),
            expect.any(String),
            {...proxyManagerOptions.socks.listen, port: 23}
        );
    });

    it('reopens connection after close', async () => {
        const storage = setupStorage();
        const sshConnection = setupSshConnection();
        ssh.openSshConnection.mockReturnValue(sshConnection);

        socks.openSocksServer
            .mockReturnValueOnce(tap(
                setupSocksServer(),
                ss => ss.address.mockReturnValueOnce({port: 42})
            ));

        socks.openSocksServer
            .mockReturnValueOnce(tap(setupSocksServer(), ss => ss.address.mockReturnValueOnce({port: 23})));

        storage.refreshListener.mockResolvedValue();

        jest.useFakeTimers();

        // exec
        const server = new SocksProxyManagerServer(proxyManagerOptions, storage);
        await server.start({watch: false});

        // assertions
        sshConnection.end();
        await server.reopenClosedConnection();

        expect(socks.openSocksServer).toHaveBeenCalledTimes(2);
        expect(socks.openSocksServer).toHaveBeenCalledWith(
            proxyManagerOptions.socks.listen.host,
            proxyManagerOptions.socks.auth,
        );

        expect(ssh.openSshConnection).toHaveBeenCalledTimes(2);
        expect(storage.storeConnection).toHaveBeenCalledWith(
            crypto.createHash('md5')
                .update(JSON.stringify(proxyManagerOptions.ssh.connections[0]))
                .digest('hex'),
            expect.any(String),
            {...proxyManagerOptions.socks.listen, port: 23}
        );
    });

    it('stop closes connections and doesnt reopen them', async () => {
        const storage = setupStorage();
        const sshConnection = setupSshConnection();
        ssh.openSshConnection.mockReturnValue(sshConnection);

        const socksServer = setupSocksServer();
        socks.openSocksServer.mockReturnValue(socksServer);
        socksServer.address.mockReturnValueOnce({port: 44});

        storage.refreshListener.mockResolvedValue();

        jest.useFakeTimers();

        // exec
        const server = new SocksProxyManagerServer(proxyManagerOptions, storage);
        await server.start({watch: true});
        await server.stop();

        // assertions

        expect(socks.openSocksServer).toHaveBeenCalledTimes(1);
        expect(socks.openSocksServer).toHaveBeenCalledWith(
            proxyManagerOptions.socks.listen.host,
            proxyManagerOptions.socks.auth,
        );

        expect(ssh.openSshConnection).toHaveBeenCalledTimes(1);
        expect(storage.storeConnection).toHaveBeenCalledWith(
            crypto.createHash('md5')
                .update(JSON.stringify(proxyManagerOptions.ssh.connections[0]))
                .digest('hex'),
            expect.any(String),
            {...proxyManagerOptions.socks.listen, port: 44}
        );

        expect(sshConnection.end).toHaveBeenCalledTimes(1);
        expect(socksServer.close).toHaveBeenCalledTimes(1);
    });

    function setupStorage() {
        return {
            storeConnection: jest.fn(),
            refreshListener: jest.fn(),
            removeListener: jest.fn(),
        };
    }

    function setupSshConnection() {
        const connection = new EventEmitter();
        connection.end = jest.fn().mockImplementationOnce(function () { this.emit('close'); });

        return connection;
    }

    function setupSocksServer() {
        const server = new EventEmitter();
        server.close = jest.fn().mockImplementationOnce(function () { this.emit('close'); });
        server.address = jest.fn();

        return server;
    }
});
