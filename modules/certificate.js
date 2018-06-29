const NodeRSA = require('node-rsa');
const response = require('../middlewares/response.js');
const config = require('../config.js');

const keys = {
    private: '-----BEGIN PRIVATE KEY-----\n' +
    'MIIEuQIBADANBgkqhkiG9w0BAQEFAASCBKMwggSfAgEAAoIBAHLMPn9dh6uE4ULk' +
    'ylQhQ+S3f8r6fbTjn4IjhToH+G2nWAoxzLjPbQ4brgSFWEOSryBwtSVZBbOAgo0S' +
    'j1vSAqaVq3Mi/LcH7mnuPQnZlKlL+H/SLb/NmpsD81CxG4YJ9G+mSZ8NwUrGO81A' +
    'N+El4BwHCECrsH4rnfSvvRcxX0+dO5+EHSUhvfdRoX3vnRtIycAxLN+qp4KU7Jmf' +
    'r0l9Kq9RPorKSvPljC07HnsBDavjQq7OMhcC7aOoozDDcu9KJe0m5LwpvharzKWz' +
    'bRJHz305jzF7CRB07L2i1Y7u0gHpR8eOGHoJed8emdTrLIMOrPiUnaS9k6DDwxpe' +
    'jYyC14kCAwEAAQKCAQAo+0kEZvtb+9/+5XZlekqmh+uTJsFhpjD3YH7bLKU/YBJJ' +
    '8WVIRKSF+NOywXe1B9SFHDdO0ez7G9F/UzTibqKLnbrLK55UKPyvzGD19zrfBUP9' +
    'PacfZeLfnBVspQ1SWJNumEqIAX0TmJkYuOg59C+BUfFcRO6I3EFTbLlwYivIW7p3' +
    'gPPHACs2L3Oo6NWS9/sNrTC3WbRFYUrUNls7eJMA7Qw2/ajOC1fvDRZLOMtH8Xes' +
    '86WuiHJUXzeHCnOGKpEd7gOxmgmYyLvr6/pd3ytIM3JWCmDmBUTvAfeoDBZIz08p' +
    'ovrXl9P9EFCxJ4GODMFTIJtVBKv/qUuVuldYcd5BAoGBALmm+CsMoFuMGjrRC4wU' +
    '7JGtscnbURr/snv93tkQN5K0NoVd81Dw6F36jf3zlsp1q8AwNkIEeXvNtKo4hRJD' +
    '57xwA0XrnX8kiATFi+dm8XKd8BcB/BNUrQfKm94ZbmJnlvhE+1mxSlppodBTGWei' +
    'gkUe/3g25YHoQu/+5M0MGNY9AoGBAJ5MG0Aih2Z2p48GkQLYmwEU0Izw4+d4tpT2' +
    'ml7kRrReuF0hWhu3ZlVuijqnudl1t1xYkP5cWbpZxAwowsrBuiGdtlBBRpNjNhFx' +
    'VaD125SYklDSWXZR7Po3tiQ2NzrlaQbM/9qi5tM/sWvIi+3e8pFBgsfKi4HwSyEc' +
    '5hw1jqc9AoGAR1f77Ic4pJWtisbE2js8QitutDS88VQr4exIlD/gK1dn0E6vb350' +
    'vZDIuju+yeT4cK3WW/5eNQ5zDCsWMFO6HTcqetc1uiNuxe6oee+cf8BkAGN53G/g' +
    '4qqgxXQecGCAqr3PncM84IvRbD5S9/mCeE+WOztVbVu1RYc9o/KvJL0Cf1zAOzdZ' +
    'A/0FiShEsLL6N9hqWcg7XU5DbLfbxpfTKZqF5YCsCiAzVcK5AkVcAYlpcAar3kkr' +
    '02ddMYHuYDRtTqJjxm8/0BqMByIxRfsKE579xr2UgtbRKglym0acfcAEq4VQmJmC' +
    '2bztlQeSemrmNzrlJ7vo8dUw9tRwGmRs/SkCgYB4yAdZQqzRFcchIAzLoWZJdZvM' +
    'UGGmZklqsg2nBwSXfEv5hDTMSJazOmzQQ5BrB/n4ibCqvinGIjCt912N962+Sr75' +
    '7mpfzCbIrW+0+81GCv2I2Xegn1N2DR30e85ledNL76Azww8ZM3JwmZfo9ksEbros' +
    'g4TmASVwBkL9DUpK+Q==\n' +
    '-----END PRIVATE KEY-----\n',
    public: '-----BEGIN PUBLIC KEY-----\n' +
    'MIIBITANBgkqhkiG9w0BAQEFAAOCAQ4AMIIBCQKCAQByzD5/XYerhOFC5MpUIUPk' +
    't3/K+n2045+CI4U6B/htp1gKMcy4z20OG64EhVhDkq8gcLUlWQWzgIKNEo9b0gKm' +
    'latzIvy3B+5p7j0J2ZSpS/h/0i2/zZqbA/NQsRuGCfRvpkmfDcFKxjvNQDfhJeAc' +
    'BwhAq7B+K530r70XMV9PnTufhB0lIb33UaF9750bSMnAMSzfqqeClOyZn69JfSqv' +
    'UT6Kykrz5YwtOx57AQ2r40KuzjIXAu2jqKMww3LvSiXtJuS8Kb4Wq8yls20SR899' +
    'OY8xewkQdOy9otWO7tIB6UfHjhh6CXnfHpnU6yyDDqz4lJ2kvZOgw8MaXo2MgteJ' +
    'AgMBAAE=\n' +
    '-----END PUBLIC KEY-----\n'
};


const rsa = new NodeRSA(keys.private);
rsa.importKey(keys.public, 'pkcs8-public-pem');

exports.generateKeys = function () {
    let key = new NodeRSA();
    let pair = key.generateKeyPair();
    return {
        public: pair.exportKey('pkcs8-public-pem'),
        private: pair.exportKey('pkcs8-private-pem')
    }
};

exports.issue = function(data) {
    data.issuedDate = new Date();
    let expDate = new Date();
    expDate.setDate(expDate.getDate() + 1);
    data.expirationDate = expDate;
    data.commonName = config.commonName;
    let str = JSON.stringify(data);
    return rsa.encryptPrivate(str, 'base64');
};

exports.read = function (data) {
    return JSON.parse(rsa.decryptPublic(data, 'utf8'));
};

exports.checkProvider = function(certificate) {
    const eobj = { text: 'Invalid provider certificate'};
    try {
        return exports.read(certificate);
    } catch (e) {
        throw new response.Error(eobj);
    }
};

