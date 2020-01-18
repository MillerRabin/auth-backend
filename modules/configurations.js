const NodeRSA = require('node-rsa');
const Router = require('koa-router');
const koaBody = require('koa-body');
const certificate = require('./certificate.js');
const Zip = require('jszip');

function checkKeys(data) {
    const hasPublic = data.public != null;
    const hasPrivate = data.private != null;
    if (!hasPublic && !hasPrivate) return false;
    if (hasPublic && hasPrivate) return true;
    if (!hasPrivate) throw new Error('There are no private key in configuration');
    if (!hasPublic) throw new Error('There are no public key in configuration');
    throw new Error('The key pair is wrong');
}

function createConfiguration(conf) {
    if (!checkKeys(conf))
        Object.assign(conf, certificate.generateKeys());
    if (conf.data == null)
        return conf;
    const rsa = new NodeRSA(conf.private);
    rsa.importKey(conf.public, 'pkcs8-public-pem');
    conf.certificate = rsa.encryptPrivate(conf, 'base64');
    return conf;
}

function createStream(config) {
    const zip = new Zip();
    zip.file('public.pem', config.public);
    zip.file('private.pem', config.private);
    zip.file('data.json', JSON.stringify(config.data));
    zip.file('certificate.b64', JSON.stringify(config.certificate));
    return zip.generateNodeStream({type:'nodebuffer',streamFiles:false});
}

exports.addController = (application, controllerName) => {
    const router = new Router();

    router.post('/' + controllerName + '/get', koaBody(), async (ctx) => {
        const data = ctx.request.body;
        const config = createConfiguration(data);
        ctx.body = createStream(config);
    });

    application.use(router.routes());
};
