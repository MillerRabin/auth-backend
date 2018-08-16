const appConfigs = require('../configs.js');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const path = require('path');
const mustache = require('mustache');
const fs = require('fs').promises;

async function getLocalTemplate(templateName, params) {
    const fileName = path.resolve(path.join(__dirname, 'templates', templateName, '.html'));
    const buffer = await fs.readFile(fileName);
    return mustache.render(buffer, params);
}


async function getTemplate({ connection, referer, templateName, params }) {
    const config = await appConfigs.getConfigByName({ connection, name: referer});
    if (config == null) return await getLocalTemplate(templateName, params);
    return await getLocalTemplate(templateName, params);
}

exports.send = async (info) => {
    const html = await getTemplate({
        connection: info.connection,
        templateName: info.template.name,
        params: info.template.params,
        referer: info.referer
    });

    const options = {
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
    const transporter = nodemailer.createTransport(smtpTransport(options));
    const from = (info.fromName != null) ? info.fromName : info.from;
    const mailOptions = {
        from: from + ' <' + info.from + '>',
        to: info.to,
        bcc: info.logs,
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