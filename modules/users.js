const Router = require('koa-router');
const koaBody = require('koa-body');
const certificate = require('./certificate.js');

const valid = require('./valid.js');
const response = require('../middlewares/response.js');
const config = require('../config.js');
const db = require('./postgres.js');
const mail = require('./mail/mail.js');

exports.getUser = ({ connection, query, includePrivate, rowMode = 'array'}) => {
    const params = [];
    const where = [];
    const fields = ['id', 'login', 'public_data' ];
    if (includePrivate) fields.push('phone', 'skype', 'email');
    if (query.email != null) where.push('email = $' + params.push(query.email));
    if (query.phone != null) where.push('phone = $' + params.push(query.phone));
    if (query.login != null) where.push('login = $' + params.push(query.login));
    if (query.id != null) where.push('id = $' + params.push(query.id));
    if (query.loginOrEmail != null) {
        const index = '$' + params.push(query.loginOrEmail);
        where.push(`(login = ${ index } or nick_name = ${ index } or email = ${ index})` );
    }
    if (query.password != null) {
        where.push(`password = crypt($${ params.push(query.password) }, password)`);
    }
    if (query.referer != null) {
        where.push(`private_data ? $${ params.push(query.referer )}`);
        fields.push(`private_data->'${ query.referer}' private_data `);
    }
    if (params.length == 0) throw new response.Error({ text: 'There are no valid parameters'});

    const dbQuery = {
        text: `select ${ fields.join(', ')} ` +
              'from users where ' + where.join(' and '),
        values: params,
        rowMode: rowMode
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
    cobj.userId = db.getData(user, 0, 'id');
    cobj.userAgent = request.headers['user-agent'];
    const cert = await certificate.issue(cobj);
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

exports.checkSession = async (request, userName) => {
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

    const session = await certificate.read(certData);
    if (!checkSession(session, userName, request))
        throw new response.Error(eobj);
    return session;
};

async function getUserByCertificate(connection, request) {
    const session = await exports.checkSession(request);
    const user = await exports.getUser({ connection, query: { id: session.userId }, includePrivate: true });
    if (user.rows.length == 0) throw new response.Error({ text: 'Certificate is invalid' });
    return await exports.authenticateUser(connection, user, request, session.type);
}

exports.byPassword = async ({ connection, user, rowMode = 'array' }) => {
    const eobj = { login: 'Wrong login or password'};
    if (user.password == null) throw new response.Error(eobj);
    const qobj = {};
    if (valid.email({ value: user.email })) qobj.email = user.email.toLowerCase();
    if (valid.login({ value: user.login })) qobj.login = user.login.toLowerCase();
    if (valid.phone({ value: user.phone })) qobj.phone = user.phone.toLowerCase();
    if (user.loginOrEmail != null) qobj.loginOrEmail = user.loginOrEmail.toLowerCase();
    if (Object.keys(qobj).length == 0) throw new response.Error(eobj);
    if (user.referer != null) qobj.referer = user.referer;
    qobj.password = (config.allowEveryone) ? null : user.password;
    const rUser = await exports.getUser({ connection, query: qobj, includePrivate: true, rowMode });
    if (rUser.rows.length == 0) throw new response.Error(eobj);
    return rUser;
};

exports.add = async ({ connection, user }) => {
    const params = [];
    const fields = [];
    const vals = [];
    if (user.email != null) {
        fields.push('email');
        vals.push('$' + params.push(user.email));
    }

    if (user.nick_name != null) {
        fields.push('nick_name');
        vals.push('$' + params.push(user.nickName));
    }

    if (user.phone != null) {
        fields.push('phone');
        vals.push('$' + params.push(user.phone));
    }

    if (user.password != null) {
        fields.push('password');
        vals.push(`crypt($${ params.push(user.password) }, gen_salt('md5'))`);
    }

    if (user.referer != null) {
        fields.push('private_data');
        const privateData = {};
        privateData[user.referer] = {};
        vals.push('$' + params.push(privateData));
    }

    const dbQuery = {
        text: `insert into users (${ fields.join(', ')}) values (${ vals.join(', ')}) returning id`,
        values: params
    };
    return connection.query(dbQuery);
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

exports.signup = async ({ connection, user }) => {
    const rUser = Object.assign(user);
    delete rUser.referer;
    const [sUser] = await exports.byPassword({ connection, rUser, rowMode: 'json' });
    if (sUser == null)
        return db.formatResponse(await exports.add({ connection, user }));
    const pData = sUser.private_data;
    const rObj = { id: sUser.id };
    if (pData[user.referer] != null) return rObj;
    pData[user.referer] = {};
    return rObj;
};

async function changePasswordByEmail({ connection, user, request }) {
    if (user.email == null) throw new Response.Error({ email: 'user email expected'});
    const userData = await exports.getUser({ connection, email: user.email, rowMode: 'json' });
    if (userData.rows.length == 0) throw new Response.Error({ message: 'Invalid email'});
    const rUser = userData.rows[0];
    const ip = exports.getIp(request);
    const cert = certificate.issue({
        email: rUser.email,
        ip: ip,
        userAgent: request.headers['user-agent']
    });
    const subject = 'Changing Password';
    const fromName = 'Registrator Raintech Open Auth';
    await mail.sendWithEvent({
        connection,
        template: {
            name: 'restorePassword',
            eventName: 'restorePasswordEvent',
            params: {
                email: rUser.email,
                referer: user.referer
            },
            referer: user.referer,
            auth: config.settings.mail.auth,
            from: config.settings.mail.from,
            fromName: fromName,
            to: user.email,
            subject: subject,
            logs: config.settings.mail.logs
        }
    })

}

exports.addController = (application, controllerName) => {
    const router = new Router();

    router.post('/' + controllerName + '/login/bypassword', koaBody(), async (ctx) => {
        async function postUser(connection, user) {
            if ((user.password == null) && (user.certificate != null))
                return await getUserByCertificate(connection, ctx.request);
            const res = await exports.byPassword({ connection, user });
            return await exports.authenticateUser(connection, res, ctx.request);
        }

        const user = ctx.request.body;
        const headers = ctx.req.headers;
        user.referer = (user.referer == null) ? headers.referer : user.referer;
        const connection = await application.pool.connect();
        try {
            return await postUser(connection, user);
        } finally {
            await connection.release();
        }
    });

    router.post('/' + controllerName + '/signup/bypassword', koaBody(), async (ctx) => {
        const user = ctx.request.body;
        const headers = ctx.req.headers;
        user.referer = (user.referer == null) ? headers.referer : user.referer;
        const connection = await application.pool.connect();
        try {
            return await exports.signup({ connection, user});
        } finally {
            await connection.release();
        }
    });

    router.post('/' + controllerName + '/changepassword/byemail', koaBody(), async (ctx) => {
        const user = ctx.request.body;
        const headers = ctx.req.headers;
        user.referer = (user.referer == null) ? headers.referer : user.referer;
        if (user.email == null) throw new response.Error({ email: 'Please specify your email'});
        const connection = await application.pool.connect();
        try {
            return await changePasswordByEmail({ connection, user, request: ctx.request });
        } finally {
            await connection.release();
        }
    });

    router.get('/' + controllerName + '/logout', async () => {
        return {text: 'Current user is successfully logout'};
    });

    application.use(router.routes());
};