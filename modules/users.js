const Router = require('koa-router');
const koaBody = require('koa-body');
const certificate = require('./certificate.js');

const valid = require('./valid.js');
const response = require('../middlewares/response.js');
const config = require('../config.js');
const db = require('./postgres.js');

exports.getUser = (connection, query) => {
    const params = [];
    const where = [];
    if (query.email != null) where.push('email = $' + params.push(query.email));
    if (query.phone != null) where.push('phone = $' + params.push(query.phone));
    if (query.login != null) where.push('login = $' + params.push(query.login));
    if (query.id != null) where.push('id = $' + params.push(query.id));
    if (query.password != null) where.push(`password = crypt($${ params.push(query.password) }, password)`);

    if (params.length == 0) throw new response.Error({ text: 'There are no valid parameters'});

    const fields = ['id', 'email', 'login', 'phone', 'skype' ];
    const dbQuery = {
        text: `select ${ fields.join(', ')}` +
              'from users where ' + where.join(' and '),
        values: params,
        rowMode: 'array'
    };
    return connection.query(dbQuery);
};

exports.getIp = (request) => {
    const str = request.headers['x-real-ip'] || request.ip;
    const rip = new RegExp("\\[([0-9a-f:]+)\]:([0-9]{1,5})");
    const ipv6 = str.match(rip);
    if (ipv6 != null) return ipv6[1];

    const ripv4 = new RegExp("([0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}):([0-9]{1,5})");
    const ipv4 = str.match(ripv4);
    if (ipv4 != null) return ipv4[1];
    return str;
};

exports.authenticateUser = async (connection, user, request) => {
    const cobj = {};
    cobj.ip = exports.getIp(request);
    cobj.email = db.getData(user, 0, 'email');
    cobj.phone = db.getData(user, 0, 'phone');
    cobj.firstName = db.getData(user, 0, 'first_name');
    cobj.lastName = db.getData(user, 0, 'last_name');
    cobj.userId = db.getData(user, 0, 'id');
    cobj.userAgent = request.headers['user-agent'];
    cobj.canModifyMaterials = db.getData(user, 0, 'can_modify_materials');
    const cert = certificate.issue(cobj);
    await exports.updateLastTime(connection, cobj.userId);
    await exports.logAuth(connection, {
        user: user,
        ip: cobj.ip
    });
    return {
        user: db.formatResponse(user),
        certificate: cert
    };
};

exports.updateLastTime = (connection, id) => {
    if (id == null) return;
    connection.query('update users set last_visited = now() where id = $1', [id]);
};

exports.checkSession = (request, userName) => {
    function checkSession(session, userName, request) {
        //let ip = exports.getIp(request);
        //if ((config.production) && (session.ip != ip)) return false;
        let userAgent = request.headers['user-agent'];
        if (session.userAgent != userAgent) return false;
        if (userName == null) return true;
        if (session.email == userName) return true;
        return (session.phone == userName);
    }

    const eobj = { text: 'The session is incorrect'};
    if (request.body == null) throw new response.Error(eobj);
    const user = (request.body.fields == null) ? request.body : request.body.fields;

    const certData = user.certificate;
    if (certData == null) throw new response.Error(eobj);

    const session = certificate.read(certData);
    if (!checkSession(session, userName, request))
        throw new response.Error(eobj);
    return session;
};

async function getUserByCertificate(connection, request) {
    const session = exports.checkSession(request);
    const user = await exports.getUser(connection, { id: session.userId });
    if (user.rows.length == 0) throw new response.Error({ text: 'Certificate is invalid' });
    return await exports.authenticateUser(connection, user, request, session.type);
}

exports.byPassword = async (connection, params) => {
    const eobj = { login: 'Ваш пароль неверен, либо такого пользователя не существует'};
    if (params.password == null) throw new response.Error(eobj);
    const qobj = {};

    if (valid.email(params.email)) qobj.email = params.email.toLowerCase();
    if (valid.login(params.login)) qobj.login = params.login.toLowerCase();
    if (valid.phone(params.login)) qobj.phone = params.phone.toLowerCase();

    if (Object.keys(qobj).length == 0) throw new response.Error(eobj);

    qobj.password = (config.allowEveryone) ? null : params.password;
    const user = await exports.getUser(connection, qobj);
    if (user.rows.length == 0) throw new response.Error(eobj);
    return user;
};

exports.logAuth = async (connection, params) => {
    if (params.user == null) return;
    const dbparams = [];
    const values = [];
    const data = [];
    const id = db.getData(params.user, 0, 'id');
    if (id != null) {
        values.push('id');
        data.push(`$${ dbparams.push(id)}`);
    }

    if (params.ip != null) {
        values.push('ip');
        data.push(`$${ dbparams.push(params.ip)}`);
    }
    const insertQuery = `insert into auth_log (${ values.join(',')}) values (${ data.join(',')})`;
    await connection.query(insertQuery, dbparams);
};

exports.addController = (application, controllerName) => {
    const router = new Router();

    router.post('/' + controllerName + '/bypassword', koaBody(), async (ctx) => {
        async function postUser(connection, user) {
            if ((user.password == null) && (user.certificate != null))
                return await getUserByCertificate(connection, ctx.request);
            const res = await exports.byPassword(connection, user);
            return await exports.authenticateUser(connection, res, ctx.request);
        }

        const user = ctx.request.body;
        const connection = await application.pool.connect();
        try {
            return await postUser(connection, user);
        } finally {
            await connection.release();
        }
    });

    router.get('/' + controllerName + '/logout', async () => {
        return {text: 'Current user is successfully logout'};
    });

    application.use(router.routes());
};