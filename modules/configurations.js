const NodeRSA = require('node-rsa');
const Router = require('koa-router');
const koaBody = require('koa-body');
const certificate = require('./certificate.js');
const Zip = require('jszip');
const uuid = require('uuid');

function checkKeys(data) {
    const hasPublic = data.public != null;
    const hasPrivate = data.private != null;
    if (!hasPublic && !hasPrivate) return false;
    if (hasPublic && hasPrivate) return true;
    if (!hasPrivate) throw new Error('There are no private key in configuration');
    if (!hasPublic) throw new Error('There are no public key in configuration');
    throw new Error('The key pair is wrong');
}

function loadConf(conf) {
    if (!checkKeys(conf))
        Object.assign(conf, certificate.generateKeys());
    if (conf.certificate == null) {
        conf.id = uuid.v4();
        return conf;
    }

    const rsa = new NodeRSA(conf.private);
    return rsa.decrypt(conf.certificate, 'base64');
}

exports.createConfiguration = (conf = {}) => {
    const nConf = loadConf(conf);
    if (nConf.data == null)
        return nConf;
    const rsa = new NodeRSA(nConf.private);
    rsa.importKey(nConf.public, 'pkcs8-public-pem');
    nConf.certificate = rsa.encryptPrivate(nConf, 'base64');
    return nConf;
};

function createStream(config) {
    const zip = new Zip();
    zip.file('public.pem', config.public);
    zip.file('private.pem', config.private);
    zip.file('data.json', JSON.stringify(config.data));
    zip.file('certificate.b64', JSON.stringify(config.certificate));
    zip.file('configuration.json', JSON.stringify({
        id: config.id,
        public: config.public,
        private: config.private,
        data: config.data
    }));
    return zip.generateNodeStream({type:'nodebuffer',streamFiles:false});
}

exports.addController = (application, controllerName) => {
    const router = new Router();

    router.post('/' + controllerName + '/get', koaBody(), async (ctx) => {
        const data = ctx.request.body;
        const config = exports.createConfiguration(data);
        ctx.body = createStream(config);
    });

    application.use(router.routes());
};
