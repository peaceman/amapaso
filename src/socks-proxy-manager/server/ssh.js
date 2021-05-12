const { Client } = require("ssh2");
const log = require("../../log");

/**
 * @param {import("./server").SshConnectionConfig} config
 */
function openSshConnection(config) {
    const client = new Client();
    const readyPromise = new Promise((resolve, reject) => {
        client.on('ready', () => {
            log.info('Established ssh connection', {
                config,
            });

            resolve(client);
        });

        client.on('error', e => {
            reject(e);
        });
    });

    client.connect(config);

    let timeoutHandle;
    const timeoutPromise = new Promise((resolve, reject) => {
        timeoutHandle = setTimeout(() => {
            client.end();
            reject(new SshConnectionTimeoutError());
        }, 10 * 1000);
    });

    return Promise
        .race([
            readyPromise
                .then(v => {
                    clearTimeout(timeoutHandle);
                    return v;
                }),
            timeoutPromise,
        ])
        .finally(() => {
            client.removeAllListeners('ready');
            client.removeAllListeners('error');
        });
}

class SshConnectionTimeoutError extends Error {
    constructor() {
        super('SSH connection timeout');
    }
}

module.exports = {
    openSshConnection,
    SshConnectionTimeoutError,
};
