const { IntentionStorage } = require('intention-storage');
const intentionStorage = new IntentionStorage();

async function addLink() {
    const link = intentionStorage.addLink([{ name: 'WebAddress', value: 'node.raintech.su'}]);
    await link.waitConnection();
    console.log(`Connected to node ${link.socket.url}`);
}

function onAuthData(status, intention, value) {
    console.log(status, intention, value);
}

function createIntention() {
    const iAuth = intentionStorage.createIntention({
        title: 'Can authenticate user',
        input: 'authData',
        output: 'token',
        onAuthData
    })
}

async function init() {
    await addLink();
    createIntention();
}

init();

