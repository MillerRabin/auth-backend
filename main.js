const koa = require('koa');
const config = require('./config.js');
const fs = require('fs');
const http = require('http');
const https = require('https');
const http2 = require('http2');
const koaStatic = require('koa-static');
const cors = require('koa2-cors');
const { Pool } = require('pg');
const users = require('./modules/users.js');
const certificate = require('./modules/certificate.js');
const configurations = require('./modules/configurations.js');
require('./modules/iAuth.js');

const response = require('./middlewares/response.js');
const responseTime = require('./middlewares/responseTime.js');

const application = new koa();
application.use(cors());

if (!config.production) {
    application.use(koaStatic(config.settings.root));
    application.use(responseTime.koa);
}

application.use(response.koa);

users.addController(application, 'api/users');
certificate.addController(application, 'api/certificate');
configurations.addController(application, 'api/configurations');

function createServer(application, port) {
    return new Promise((resolve, reject) => {
        const options = {
            key: config.production ? fs.readFileSync(config.settings.ssl.key) : null,
            cert: config.production ? fs.readFileSync(config.settings.ssl.cert) : null
        };

        let server = (config.useHttp2) ? config.production ? http2.createSecureServer(options, application.callback()) :
            http2.createServer({}, application.callback()) :
            config.production ? https.createServer(options, application.callback()) :
                http.createServer(application.callback());
        server.listen(port, (err) => {
            if (err != null) return reject(err);
            console.log('Server accepts connections at ' + port);
            return resolve();
        });
    });
}

async function createPool() {
    const pool = new Pool(config.settings.pool);
    pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
    });
    return pool;
}

async function start(application, port) {
    try {
        application.pool = await createPool(application);
        await createServer(application, port);
    } catch (err) {
        console.log(err);
    }
}

process.on('unhandledRejection', function(reason, p) {
    console.log("Possibly Unhandled Rejection at: Promise ", p, " reason: ", reason);
});

start(application, config.port);
