const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const Router = require('koa-router');
const koaBody = require('koa-body');
const response = require('../../middlewares/response.js');
const path = require('path');

exports.send = async (info) => {
    let html = pug.renderFile(path.join(__dirname, 'templates', info.template), info.templateData);
    let options = {
        secure: true,
        host: 'smtp.yandex.ru',
        name: 'smtp.yandex.ru',
        port: 465,
        tls: {
            rejectUnauthorized: false
        },
        auth: {
            user: info.auth.user,
            pass: info.auth.password
        }
    };
    let transporter = nodemailer.createTransport(smtpTransport(options));
    let from = info.from;
    from = (info.fromName != null) ? info.fromName : from;
    let mailOptions = {
        from: from + ' <' + info.from + '>',
        to: info.to,
        bcc: 'logs@anna.systems',
        subject: info.subject,
        html: html
    };
    return new Promise(function (resolve, reject) {
        transporter.sendMail(mailOptions, function(error, data) {
            if (error) {
                console.log(mailOptions);
                return reject(error);
            }
            return resolve(data);
        });
    });
};

exports.addController = (application, controllerName) => {
    let router = new Router();

    router.post('/' + controllerName + '/send', koaBody(), async (ctx) => {
        return await exports.send(ctx.request.body).catch((err) => {
            console.log(err);
            throw new response.Error(err);
        });
    });

    application.use(router.routes());
};
