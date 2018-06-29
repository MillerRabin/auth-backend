exports.Error = function (data) {
    Object.assign(this, data);
};

require('util').inherits(exports.Error, Error);

let gDefTable = {
    'ORA-00001': { text: 'already exists' },
    'ORA-00904': { text: 'invalid identifier', paramIndex: 1 },
    'ORA-01400': { text: 'missing parameter' },
    'ORA-02291': { text: 'linked object not found'},
    'ORA-01722': { text: 'Wrong number format'}
};

function getOracleError(err, errTable) {
    function getFromTable(code, message) {
        let data = null;
        if (errTable != null) data = errTable[code];
        if (data == null) data = gDefTable[code];
        if (data == null) return {
            code: code,
            text: message
        };
        return {
            text: data.text,
            paramIndex: data.paramIndex
        };
    }

    if (err.message != null) {
        let pArr = err.message.split(':');
        if (pArr.length == 1) return null;
        let code =  pArr[0];
        let data = getFromTable(code, err.message);
        if (data != null) {
            if (data.paramIndex != null)
                data.text = data.text + ' ' + pArr[data.paramIndex];
            return data;
        } else {
            return { code: pArr[0], text: pArr[1] };
        }
    }
    return null;
}

exports.koa = async (ctx, next) => {
    try {
        let data = await next();
        if ((data != null) && (ctx.body == null))
            ctx.body = data;
    } catch (err) {
        console.log(err);
        if (err instanceof exports.Error) {
            ctx.status = 400;
            ctx.body = err;
            return;
        }

        let data = getOracleError(err, null);
        if (data != null) {
            ctx.status = 400;
            ctx.body = data;
            return;
        }

        ctx.status = err.statusCode || err.status || 500;
        ctx.body = {
            text: err.message
        }
    }
};

exports.buildMultipartData = (data) => {
    const reg = new RegExp(/^(.+)\[(.+)]$/);
    const res = {};
    for (let key in data) {
        if (!data.hasOwnProperty(key)) continue;
        const objectData = reg.exec(key);
        if (objectData != null) {
            const aKey = objectData[1];
            const aField = objectData[2];
            if (res[aKey] == null) res[aKey] = {};
            res[aKey][aField] = data[key];
            continue;
        }
        res[key] = data[key];
    }
    return res;
};

exports.buildMultipartArray = (data) => {
    const reg = new RegExp(/^(\d+)\[(.+)]$/);
    const res = [];
    const keys = {};
    for (let key in data) {
        if (!data.hasOwnProperty(key)) continue;
        let arrayData = reg.exec(key);
        if (arrayData != null) {
            let aKey = arrayData[1];
            let aField = arrayData[2];
            if (keys[aKey] == null) keys[aKey] = res.push({});
            let obj = res[keys[aKey] - 1];
            obj[aField] = data[key];
            continue;
        }
        res[key] = data[key];
    }
    return res;
};