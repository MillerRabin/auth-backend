const safe = require('./safe.js');

exports.email = function(params) {
    params.errors = (params.errors == null) ? {} : params.errors;
    params.field = safe.isEmpty(params.field) ? 'email' : params.field;
    if ((typeof(params.value) != 'string') || (params.value.length > 32)) {
        params.errors[params.field] = 'Please provide your e-mail address';
        return false;
    }

    if (params.value.length > 32) {
        params.errors[params.field] = 'The email is longer than 32 symbols';
        return false;
    }

    const sa = params.value.split('@');
    if (sa.length != 2) {
        params.errors[params.field] = 'The email is incorrect';
        return false;
    }
    return true;
};

exports.int = function(number, min, max, field, errors) {
    if (typeof(number) != 'number') {
        errors[field] = 'Некорректный формат числа';
        return false;
    }
    if (number < min) {
        errors[field] = 'Число меньше ' + min;
        return false;
    }
    if (number > max) {
        errors[field] = 'Число больше ' + max;
        return false;
    }
    return true;
};

exports.identity = function(id, field, errors) {
    if ((id == null) || (id == 0)) {
        errors[field] = 'id field expected';
        return false;
    }
    return true;
};

exports.isDate = function(item) {
    if (item == null) return false;
    if (item.constructor == false) return false;
    return item.constructor == Date;
};

exports.phone = function(params) {
    params.errors = (params.errors == null) ? {} : params.errors;
    params.field = safe.isEmpty(params.field) ? 'phone' : params.field;
    const pi = Number(params.value);
    if (isNaN(pi)) {
        params.errors[params.field] = 'Incorrect phone';
        return false;
    }
    return pi >= 1000000;
};

exports.password = (params) => {
    params.errors = (params.errors == null) ? {} : params.errors;
    params.field = safe.isEmpty(params.field) ? 'password' : params.field;
    if (typeof(params.value) != 'string') {
        params.errors[params.field] = 'Please provide your password';
        return false;
    }

    if (safe.isEmpty(params.value)) {
        params.errors[params.field] = 'Please provide your password';
        return false;
    }

    const length = params.value.length;
    if (length < 6) {
        params.errors[params.field] = 'The password is less than 6 symbols';
        return false;
    }

    if (length >32) {
        params.errors[params.field] = 'The password is longer than 32 symbols';
        return false;
    }

    return true;
};

exports.login = (params) => {
    params.errors = (params.errors == null) ? {} : params.errors;
    params.field = safe.isEmpty(params.field) ? 'login' : params.field;
    if (typeof(params.value) != 'string') {
        params.errors[params.field] = 'Please provide your login';
        return false;
    }

    if (safe.isEmpty(params.value)) {
        params.errors[params.field] = 'Please provide your login';
        return false;
    }

    if (params.value.length > 32) {
        params.errors[params.field] = 'The login is longer than 32 symbols';
        return false;
    }
    return true;
};
