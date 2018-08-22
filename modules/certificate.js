const NodeRSA = require('node-rsa');
const response = require('../middlewares/response.js');
const config = require('../config.js');
const fs = require('fs').promises;
const mkdirp = require('mkdirp-promise');
const path = require('path');
const Router = require('koa-router');

exports.generateKeys = function () {
    const rsa = new NodeRSA();
    const pair = rsa.generateKeyPair();
    return {
        public: pair.exportKey('pkcs8-public-pem'),
        private: pair.exportKey('pkcs8-private-pem')
    }
};

exports.saveKeys = async (destFolder) => {
    await mkdirp(destFolder);
    const pair = exports.generateKeys();
    const publicPath = path.join(destFolder, 'public.key');
    const privatePath = path.join(destFolder, 'private.key');
    await fs.writeFile(publicPath, pair.public);
    await fs.writeFile(privatePath, pair.private);
    return pair;
};

exports.readKeys = async (sourceFolder) => {
    const publicPath = path.join(sourceFolder, 'public.key');
    const privatePath = path.join(sourceFolder, 'private.key');
    const publicKey = await fs.readFile(publicPath);
    const privateKey = await fs.readFile(privatePath);
    return {
        private: privateKey,
        public: publicKey
    }
};

exports.getKeys = async (folder) => {
    try {
        return await exports.readKeys(folder);
    } catch (e) {
        console.log('Generate the new pair of keys into ".keys" folder');
        return await exports.saveKeys(folder);
    }
};

exports.issue = async function(data, params = {}) {
    const rsa = await moduleLoad;
    data.issuedDate = new Date().getTime();
    params.lifeTime = (params.lifeTime == null) ? 86400000 * 2 : params.lifeTime * 1000;
    data.expirationDate = data.issuedDate + params.lifeTime;
    data.commonName = config.commonName;
    const str = JSON.stringify(data);
    return rsa.encryptPrivate(str, 'base64');
};

exports.read = async function (data) {
    const rsa = await moduleLoad;
    return JSON.parse(rsa.decryptPublic(data, 'utf8'));
};

exports.checkProvider = function(certificate) {
    const eobj = { text: 'Invalid provider certificate'};
    try {
        return exports.read(certificate);
    } catch (e) {
        throw new response.Error(eobj);
    }
};

async function load(keyFolder) {
    const keys = await exports.getKeys(keyFolder);
    const rsa = new NodeRSA(keys.private);
    rsa.importKey(keys.public, 'pkcs8-public-pem');
    return rsa;
}

const keyPath = path.join(process.cwd(), '.keys');
const moduleLoad = load(keyPath);

exports.addController = (application, controllerName) => {
    const router = new Router();

    router.get('/' + controllerName + '/key', async () => {
        const rsa = await moduleLoad;
        const pubkey = rsa.exportKey('pkcs8-public-pem');
        return {
            public:  pubkey
        }
    });

    application.use(router.routes());
};
