const { IntentionStorage } = require('intention-storage');
const intentionStorage = new IntentionStorage();

async function addLink() {
    const link = intentionStorage.addLink([{ name: 'WebAddress', value: 'localhost'}]);
    await link.waitConnection();
    console.log(`Connected to node ${link.socket.url}`);
}

async function onAuthData(status, intention, value) {
    console.log(status, intention, value);
}

function createIntention() {
    const iAuth = intentionStorage.createIntention({
        title: 'Can authenticate user',
        input: 'authData',
        output: 'token',
        onData: onAuthData
    })
}

async function init() {
    await intentionStorage.createServer({ address: 'localhost', port: '10011'});
    await addLink();
    createIntention();
}

init();

