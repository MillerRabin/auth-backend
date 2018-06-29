exports.email = function(str, field, errors) {
    if (str == null) {
        if ((field == null) || (errors == null)) return false;
        errors[field] = 'Please provide your e-mail address';
        return false;
    }
    let sa = str.split('@');
    if (sa.length != 2) {
        if ((field == null) || (errors == null)) return false;
        errors[field] = 'The email is incorrect';
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

exports.phone = function(phone) {
    let pi = parseInt(phone);
    if (isNaN(pi)) {
        return false;
    }
    return pi >= 1000000;
};

exports.password = (str, field, errors) => {
    if ((str == null) || (str == '')) {
        if ((errors == null) || (field == null)) return false;
        errors[field] = 'Please, provide your password';
        return false;
    }
    if (str.length < 6) {
        if ((errors == null) || (field == null)) return false;
        errors[field] = 'The password must be 6 o more symbols';
        return false;
    }
    return true;
};
