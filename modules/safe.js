exports.setNumberBoundary = (data, field, min = 0, max = 100) => {
    if (data[field] == null) return;
    let val = data[field];
    if (val < min) val = min;
    if (val > max) val = max;
    data[field] = val;
};

exports.isEmpty = (value) => {
    return (value == null) || (value == '') || (value == 'null');
};

exports.toBoolean = (value) => {
    if (value == 'false') return false;
    if (value == 'true') return true;
    return !!value;
};