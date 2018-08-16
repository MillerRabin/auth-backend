const path = require('path');
const fs = require('fs');

const productionSettings = {
    ssl: {
        key: '/etc/letsencrypt/live/auth.raintech.su/privkey.pem',
        cert: '/etc/letsencrypt/live/auth.raintech.su/fullchain.pem'
    },
    pool : {
        host: 'localhost',
        user: 'master',
        database: 'auth',
        port: 5437,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 60000
    }
};

const developSettings = {
    root: path.resolve(__dirname + '/../auth-frontend')
};

if (exports.production == null)
    exports.production = (process.argv[2] != 'debug');


exports.commonName = 'auth.raintech.su';
exports.useHttp2 = false;
exports.allowEveryone = false;

exports.port = process.env.PORT | 8093;

exports.settings = exports.production ? productionSettings : developSettings;

const credentials = JSON.parse(fs.readFileSync('./credentials.json', { encoding: 'utf-8'}));
exports.settings.pool = (exports.settings.pool == null) ? credentials.databasePool : exports.settings.pool;
exports.settings.mail = (exports.settings.mail == null) ? credentials.mail : exports.settings.mail;