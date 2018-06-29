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
    if (query.id != null) where.push('id = $' + params.push(query.id));
    if (query.password != null) where.push(`password = crypt($${ params.push(query.password) }, password)`);
    if (query.first_name != null) where.push(`(lower(first_name) = $${params.push(query.first_name) })`);
    if (query.last_name != null) where.push(`(lower(last_name) = $${params.push(query.last_name) })`);
    if (params.length == 0) throw new response.Error({ text: 'There are no valid parameters'});
    const dbQuery = {
        text: 'select id, email, first_name, last_name, phone, skype, ' +
        'reg_time, can_modify_materials from users where ' + where.join(' and '),
        values: params,
        rowMode: 'array'
    };
    return connection.query(dbQuery);
};

exports.getIp = (request) => {
    let str = request.headers['x-real-ip'] || request.ip;
    let rip = new RegExp("\\[([0-9a-f:]+)\]:([0-9]{1,5})");
    let res = str.match(rip);
    if (res != null) return res[1];

    let ripv4 = new RegExp("([0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}):([0-9]{1,5})");
    res = str.match(ripv4);
    if (res != null) return res[1];
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

exports.login = async (connection, params) => {
    let eobj = { login: 'Ваш пароль неверен, либо такого пользователя не существует'};
    if (params.password == null) throw new response.Error(eobj);
    if (params.email == null)
        throw new response.Error(eobj);

    let qobj = (valid.email(params.email)) ? { email: params.email.toLowerCase()} :
        (valid.phone(params.email)) ? { phone: params.email } :
            null;

    if (qobj == null) throw new response.Error(eobj);
    if (!config.allowEveryone)
        qobj.password = params.password;
    const user = await exports.getUser(connection, qobj, true);
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

    router.post('/' + controllerName + '/login', koaBody(), async (ctx) => {
        async function postUser(connection, user) {
            if ((user.password == null) && (user.certificate != null))
                return await getUserByCertificate(connection, ctx.request);
            const res = await exports.login(connection, user);
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