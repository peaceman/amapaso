
const { SocksProxyManagerServer } = require('./server');
const ssh = require('./ssh');
const socks = require('./socks');
const EventEmitter = require('events');
const crypto = require('crypto');

jest.mock('./ssh');
jest.mock('./socks');

describe('socks proxy manager server', () => {
    it('opens connections', async () => {
        const storage = setupStorage();
        const options = {
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

        const sshConnection = setupSshConnection();
        ssh.openSshConnection.mockReturnValueOnce(sshConnection);

        // emit close events every time a listener is registered on the
        // ssh connection to immediately bring the runOnce promise to an end
        const originalOn = sshConnection.on.bind(sshConnection);
        sshConnection.on = (...a) => {
            originalOn(...a);
            sshConnection.emit('close');
        };

        const socksServer = setupSocksServer();
        socks.openSocksServer.mockReturnValueOnce(socksServer);
        socksServer.address.mockReturnValueOnce({port: 44});

        // exec
        const server = new SocksProxyManagerServer(options, storage);
        await server.runOnce();

        // assertions
        expect(socks.openSocksServer).toHaveBeenCalledWith(
            options.socks.listen.host,
            options.socks.auth,
        );

        expect(ssh.openSshConnection).toHaveBeenCalledWith(options.ssh.connections[0]);
        expect(storage.storeConnection).toHaveBeenCalledWith(
            crypto.createHash('md5')
                .update(JSON.stringify(options.ssh.connections[0]))
                .digest('hex'),
            expect.any(String),
            {...options.socks.listen, port: 44}
        );
    });

    function setupStorage() {
        return {
            storeConnection: jest.fn(),
        };
    }

    function setupSshConnection() {
        const connection = new EventEmitter();
        connection.end = jest.fn();

        return connection;
    }

    function setupSocksServer() {
        const server = new EventEmitter();
        server.close = jest.fn();
        server.address = jest.fn();

        return server;
    }
});
