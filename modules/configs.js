const response = require('../middlewares/response.js');

exports.query = ({ connection, query, rowMode = 'array'}) => {
    const params = [];
    const where = [];
    if (query.name != null) where.push('name = $' + params.push(query.name));
    if (query.id != null) where.push('id = $' + params.push(query.id));
    if (params.length == 0) throw new response.Error({ text: 'There are no valid parameters'});

    const dbQuery = {
        text: 'select name, config, create_time, update_time ' +
        'from configs where ' + where.join(' and '),
        values: params,
        rowMode: rowMode
    };
    return connection.query(dbQuery);
};

exports.getConfigByName = async ({ connection, name }) => {
    const appConfig = await exports.query({
        connection,
        query: { name: name },
        rowMode: 'json'
    });
    if (appConfig.rows.length == 0) return null;
    return appConfig.rows[0];
};