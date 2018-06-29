const config = require('../config.js');

exports.koa = async (ctx, next) => {
    const start = new Date();
    let data = await next();
    if (ctx.request.req.method == 'OPTIONS') return;
    const ms = new Date() - start;
    ctx.response.set('request-time', ms);
    if (ms >= config.minimumTime )
        console.log(`${ctx.method} ${ctx.url} - ${ms} ms`);
    return data;
};
