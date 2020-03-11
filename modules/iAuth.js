const { IntentionStorage } = require('intention-storage');
const configurations = require('./configurations.js');
const intentionStorage = new IntentionStorage();

async function addLink() {
    const link = intentionStorage.addLink([{ name: 'WebAddress', value: 'node.raintech.su'}]);
    await link.waitConnection();
    console.log(`Connected to node ${link.socket.url}`);
}

function startSendingConfigurations(intentionStorage) {
    return intentionStorage.createIntention({
        title: 'Can authenticate device',
        input: 'AuthData',
        output: 'AuthConfiguration',
        onData: async function (status, intention, value) {
            if (status == 'accepted') {
                const config = configurations.createConfiguration(value);
                intention.send('authConfiguration', this, config);
            }
        }
    });
}

async function init() {
    await intentionStorage.createServer({ address: 'localhost', port: '10011'});
    addLink();
    startSendingConfigurations(intentionStorage);
}

init();

