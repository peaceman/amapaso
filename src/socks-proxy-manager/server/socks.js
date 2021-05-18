const socks = require('socksv5');
const log = require('../../log');

/**
 * @param {string} host
 * @param {import("./server").SocksAuthOptions} auth
 */
function openSocksServer(host, auth) {
    const isAuthConfigured = auth.username !== undefined && auth.password !== undefined;

    const server = new socks.Server({
        auths: [
            isAuthConfigured
                ? socks.auth.UserPassword((u, p, cb) =>
                    cb(u === auth.username && p === auth.password))
                : socks.auth.None(),
        ],
    });

    const promise = new Promise((resolve, reject) => {
        server.on('listening', () => {
            log.info('Socks server started listening', {
                address: server.address(),
            });

            resolve(server);
        });

        server.on('error', (e) => {
            log.warn('Socks server failed to start listening', {
                error: e,
            });

            reject(e);
        });
    });

    server.listen(undefined, host);

    return promise
        .finally(() => {
            server.removeAllListeners('listening');
            server.removeAllListeners('error');
        });
}

module.exports = {
    openSocksServer,
};
