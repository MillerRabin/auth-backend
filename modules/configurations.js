const NodeRSA = require('node-rsa');
const Router = require('koa-router');
const koaBody = require('koa-body');
const certificate = require('./certificate.js');
const Zip = require('jszip');
const uuid = require('uuid');

exports.createKeys = () => {
    const conf =certificate.generateKeys();
    conf.id = uuid.v4();
    return conf;
};

function createStream(config) {
    const zip = new Zip();
    zip.file('public.pem', config.public);
    zip.file('private.pem', config.private);
    zip.file('configuration.json', JSON.stringify({
        id: config.id,
        public: config.public,
        private: config.private
    }));
    return zip.generateNodeStream({type:'nodebuffer',streamFiles:false});
}

exports.addController = (application, controllerName) => {
    const router = new Router();

    router.post('/' + controllerName + '/get', koaBody(), async (ctx) => {
        const data = ctx.request.body;
        const config = exports.createKeys();
        ctx.body = createStream(config);
    });

    application.use(router.routes());
};
