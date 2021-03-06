const Router = require('koa-router');
const koaBody = require('koa-body');
const certificate = require('./certificate.js');

const valid = require('./valid.js');
const response = require('../middlewares/response.js');
const config = require('../config.js');
const mail = require('./mail/mail.js');

const urlLink = require('./urlLink.js');
const querystring = require('querystring');

exports.getUser = ({ connection, query, addFields = [], rowMode = 'array'}) => {
    const params = [];
    const where = [];
    const fields = ['id', 'login', 'public_data' ];
    fields.push(...addFields);
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
        fields.push(`private_data->'${ query.referer}' private_data`);
        fields.push(`rights->'${ query.referer}' rights`);
    } else {
        fields.push('private_data', 'rights');
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

async function getCertificate({ request, certParams = {}, }) {
    const cobj = Object.assign(certParams);
    cobj.ip = exports.getIp(request);
    cobj.userAgent = request.headers['user-agent'];
    const cert = await certificate.issue(cobj);
    return {
        obj: cobj,
        certificate: cert
    }
}

exports.renewCertificateIfNeeded = async (session, request, response) => {
    const time = new Date().getTime();
    const renewTime = session.expirationDate - 86400000;
    if (time < renewTime) return;
    const cobj = await getCertificate({ request, certParams: { userId: session.userId }});
    response.headers['certificate'] = cobj.certificate;
};

exports.authenticateUser = async ({connection, user, request, referer}) => {
    const cobj = await getCertificate({request, certParams: { userId: user.id, rights: user.rights, referer: referer }});
    await exports.updateLastTime(connection, cobj.obj.userId);
    await exports.logAuth(connection, {
        user: user,
        ip: cobj.obj.ip
    });
    return {
        user: user,
        certificate: cobj.certificate
    };
};

exports.updateLastTime = (connection, id) => {
    if (id == null) return;
    connection.query('update users set last_visited = now() where id = $1', [id]);
};

exports.checkSession = async (request) => {
    function checkSession(session, request) {
        const ip = exports.getIp(request);
        if ((config.production) && (session.ip != ip)) throw new response.Error({ message: 'Invalid ip', code: 'CertInvalidIp'});
        const userAgent = request.headers['user-agent'];
        if (session.userAgent != userAgent) throw new response.Error({ message: 'invalid user agent', code: 'CertInvalidUserAgent'});
        const time = new Date().getTime();
        if (time > session.expirationDate) throw new response.Error({ message: 'Your certificate is expired', code: 'CertExpired'});
        return session;
    }


    const eobj = { message: 'Invalid certificate', code: 'invalidCertificate' };
    if (request.body == null) throw new response.Error(eobj);
    const user = (request.body.fields == null) ? request.body : request.body.fields;

    const certData = user.certificate;
    if (certData == null) throw new response.Error(eobj);

    const session = await certificate.read(certData);
    return checkSession(session, request);
};

async function getUserByCertificate(connection, request) {
    const session = await exports.checkSession(request);
    const user = await exports.getUser({ connection, query: { id: session.userId }, rowMode: 'json', addFields: ['phone', 'skype', 'email'] });
    if (user.rows.length == 0) throw new response.Error({ message: 'Certificate is invalid' });
    return await exports.authenticateUser({connection, user: user.rows[0], request, referer: session.referer });
}

function prepareLoginData(user) {
    const qobj = {};
    if (valid.email({ value: user.email })) qobj.email = user.email.toLowerCase();
    if (valid.login({ value: user.login })) qobj.login = user.login.toLowerCase();
    if (valid.phone({ value: user.phone })) qobj.phone = user.phone.toLowerCase();
    if (user.loginOrEmail != null) qobj.loginOrEmail = user.loginOrEmail.toLowerCase();
    return qobj;
}

function getPassword(user) {
    return (user.password == null) ? user.newPassword : user.password;
}

exports.byPassword = async ({ connection, user }) => {
    const eobj = { login: 'Wrong login or password'};
    const qobj = prepareLoginData(user);
    if (Object.keys(qobj).length == 0) throw new response.Error(eobj);
    if (user.referer != null) qobj.referer = user.referer;
    qobj.password = getPassword(user);
    if (config.allowEveryone) {
        qobj.password = null;
    } else if (qobj.password == null)
        throw new response.Error(eobj);

    const rUser = await exports.getUser({ connection, query: qobj, rowMode: 'json', addFields: ['phone', 'skype', 'email'] });
    if (rUser.rows.length == 0) throw new response.Error(eobj);
    return rUser.rows[0];
};

exports.add = async ({ connection, user, rowMode = 'json' }) => {
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
        text: `insert into users (${ fields.join(', ')}) values (${ vals.join(', ')}) returning id, login, public_data, private_data, email, phone, skype`,
        rowMode: rowMode,
        values: params
    };
    return connection.query(dbQuery);
};

exports.logAuth = async (connection, params) => {
    if (params.user == null) return;
    const dbparams = [];
    const values = [];
    const data = [];
    const id = params.user.id;
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

function getRefererBranch(data, referer) {
    const rObj = {};
    rObj[referer] = data[referer];
    return rObj;
}

async function notifyNewUser({ connection, user}) {
    const fromName = 'Registrator Raintech Open Auth';
    const subject = 'Your registration at ' + user.referer;
    const pwd = getPassword(user);
    return await mail.sendWithEvent({
        connection,
        template: {
            name: 'newUser',
            eventName: 'newUserEvent',
            params: {
                login: user.email,
                referer: user.referer,
                password: pwd
            },
        },
        referer: user.referer,
        auth: config.settings.mail.auth,
        from: config.settings.mail.from,
        fromName: fromName,
        to: user.email,
        subject: subject,
        logs: config.settings.mail.logs
    });
}


async function createNewUser({ connection, user}) {
    const aData = await exports.add({ connection, user, rowMode: 'json' });
    const newUser = aData.rows[0];
    newUser.private_data = getRefererBranch(newUser.private_data, user.referer);
    await notifyNewUser({ connection, user });
    return newUser;
}



exports.signup = async ({ connection, user }) => {
    const qobj = prepareLoginData(user);
    qobj.password = getPassword(user);
    const sUserData = await exports.getUser({ connection, query: qobj, rowMode: 'json', addFields: ['email', 'phone', 'skype'] });
    const sUser = sUserData.rows[0];
    if (sUser == null) {
        return await createNewUser({ connection, user });
    }
    const pData = (sUser.private_data == null) ? {} : sUser.private_data;
    if (pData[user.referer] != null) {
        sUser.private_data = getRefererBranch(pData, user.referer);
        return sUser;
    }
    pData[user.referer] = {};
    await exports.update({ connection, id: sUser.id, data: { private_data: pData } });
    await notifyNewUser({ connection, user });
    sUser.private_data = getRefererBranch(pData, user.referer);
    return sUser;
};

async function changePasswordByEmail({ connection, user, request }) {
    if (user.email == null) throw new response.Error({ email: 'user email expected'});
    const userData = await exports.getUser({ connection, query: { email: user.email }, rowMode: 'json', addFields: ['phone', 'skype', 'email'] });
    if (userData.rows.length == 0) throw new response.Error({ email: 'Invalid email'});
    const rData = await exports.authenticateUser({connection, user: userData.rows[0], request, referer: user.referer});
    const subject = 'Changing Password';
    const fromName = 'Registrator Raintech Open Auth';
    const link = 'https://' + urlLink.join(user.referer, '/changepassword.html');
    const fullLink = link + '?' + querystring.stringify({ cert: rData.certificate });
    await mail.sendWithEvent({
        connection,
        template: {
            name: 'restorePassword',
            eventName: 'restorePasswordEvent',
            params: {
                email: user.email,
                referer: user.referer,
                link: fullLink
            },
        },
        referer: user.referer,
        auth: config.settings.mail.auth,
        from: config.settings.mail.from,
        fromName: fromName,
        to: user.email,
        subject: subject,
        logs: config.settings.mail.logs
    });
    return rData;
}

exports.update = async ({ connection, id, data }) => {
    if (id == null) throw new response.Error({ id: 'User id expected'});
    const vals = [];
    const params = [id];
    if (data.newPassword != null) {
        if (data.newPassword != data.confirmPassword) throw new response.Error({ confirmPassword: 'The passwords does not match'});
        vals.push(`password = crypt($${ params.push(data.newPassword) }, gen_salt('md5'))`);
    }
    if (vals.length == 0) throw new response.Error({message: 'there are no valid fields' });
    vals.push('update_time = now()');
    const dbQuery = {
        text: `update users set ${ vals.join(', ')} where id = $1`,
        values: params
    };
    const results = await connection.query(dbQuery);
    if (results.rowsAffected == 0) throw new response.Error({ message: 'No users updated'});
    return { message: 'update success'};
};


exports.addController = (application, controllerName) => {
    const router = new Router();

    router.post('/' + controllerName + '/login/bycert', koaBody(), async (ctx) => {
        const user = ctx.request.body;
        user.referer = urlLink.getReferer(ctx.req, user);
        if (user.certificate == null) throw new response.Error({ certificate: 'Certificate expected'});
        const connection = await application.pool.connect();
        try {
            return await getUserByCertificate(connection, ctx.request);
        } finally {
            await connection.release();
        }
    });

    router.post('/' + controllerName + '/login/bypassword', koaBody(), async (ctx) => {
        const user = ctx.request.body;
        user.referer = urlLink.getReferer(ctx.req, user);
        const connection = await application.pool.connect();
        try {
            const res = await exports.byPassword({ connection, user });
            return await exports.authenticateUser({connection, user: res, request: ctx.request, referer: user.referer });
        } finally {
            await connection.release();
        }
    });

    router.post('/' + controllerName + '/signup/bypassword', koaBody(), async (ctx) => {
        const user = ctx.request.body;
        user.referer = urlLink.getReferer(ctx.req, user);
        const connection = await application.pool.connect();
        try {
            const rUser = await exports.signup({ connection, user});
            return await exports.authenticateUser({connection, user: rUser, request: ctx.request, referer: user.referer });
        } finally {
            await connection.release();
        }
    });

    router.post('/' + controllerName + '/changepassword/byemail', koaBody(), async (ctx) => {
        const user = ctx.request.body;
        user.referer = urlLink.getReferer(ctx.req, user);
        if (user.email == null) throw new response.Error({ email: 'Please specify your email'});
        const connection = await application.pool.connect();
        try {
            await changePasswordByEmail({ connection, user, request: ctx.request });
            return { message: 'The link to change password is sent to your email' };
        } finally {
            await connection.release();
        }
    });

    router.put('/' + controllerName, koaBody(), async (ctx) => {
        const user = ctx.request.body;
        const session = await exports.checkSession(ctx.request);
        const connection = await application.pool.connect();
        try {
            const rData = await exports.update({ connection, id: session.userId, data: user });
            await exports.renewCertificateIfNeeded(session, ctx.request, ctx.response);
            return rData;
        } finally {
            await connection.release();
        }
    });

    router.get('/' + controllerName + '/logout', async () => {
        return {message: 'Current user is successfully logout'};
    });

    application.use(router.routes());
};