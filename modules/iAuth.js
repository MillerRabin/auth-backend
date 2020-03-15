const { IntentionStorage } = require('intention-storage');
const configurations = require('./configurations.js');
const intentionStorage = new IntentionStorage();

const address = {
    address: 'localhost',
    port: 10011
};

async function addLink() {
    const link = intentionStorage.addLink([{ name: 'WebAddress', value: 'node.raintech.su'}]);
    await link.waitConnection();
    console.log(`Connected to node ${link.socket.url}`);
}

function startSendingConfigurations(intentionStorage) {
    return intentionStorage.createIntention({
        title: 'Can create auth keys',
        input: 'AuthData',
        output: 'AuthKeys',
        onData: async function (status, intention) {
            if (status == 'accepted') {
                const config = configurations.createKeys();
                intention.send('data', this, config);
            }
        }
    });
}

async function init() {
    await intentionStorage.createServer(address);
    addLink();
    startSendingConfigurations(intentionStorage);
}

init();

