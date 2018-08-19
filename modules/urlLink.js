const url = require('url');

exports.join = (...elements) => {
    const args = [];
    for (let elem of elements) {
        const melem = elem.replace(/^\/+|\/+$/g, '');
        args.push(melem);
    }
    return args.join('/');
};

exports.getReferer = (request, user) => {
    const headers = request.headers;
    if (user.referer != null) return user.referer;
    const refObj = url.parse(headers.referer);
    return refObj.host;
};
