"use strict";
const os = require('os');
let DEV = (process.env.ENV == 'rw');
console.log('DEV=' + DEV + ' process.env.ENV=' + process.env.ENV);
const io = require('bitex.gg');
const sanitizeHtml = require('sanitize-html');
const sanitizeHtml_config = {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'font', 'u', 'br', 'p'],
    allowedAttributes: { 'a': ['href'] } };

// bootstrap, pass api and api-key
// - YOUR STORED API+API_KEY
io.init('/backend/tls/.bitex.private', DEV); // json with api and api_key
ENDPOINTS_SETUP(false); // - WHERE TO CONNECT? (most handled automaticly)

module.exports = {
    init: init,
    routers: routers,
    get_io: get_io,
    api_call: api_call
};


function init(APPLICATION_ONLINE) {
    const API = undefined; // if passed as arg or from .bitex.private.
    const API_KEY = undefined; // if passed as arg or from .bitex.private.
    io.connect(APPLICATION_ONLINE, API, API_KEY, DEV); // call back after connected.
}

function routers(express_server) {
    express_server.get('/', index);
    express_server.get('/newAccount', newAccount);
    express_server.get('/editAccount', editAccount);
    express_server.get('/accountProfile', accountProfile);
    express_server.get('/accountBalances', accountBalances);
    express_server.post('/api/v1/newAccount', saveNewAccount);
    express_server.post('/api/v1/updateAccount', updateAccount);
    express_server.post('/api/v1/logIn', logIn);
    express_server.get('/api/v1/signOff', signOff);
    express_server.get('/Faucet', Faucet);
    express_server.get('/sendMoneyTo/:Symbol', sendMoneyTo);
    express_server.post('/api/v1/sendMoneyTo/:FromBalance_id', sendMoneyToExec);
    express_server.get('/sendFiat', sendFiat);
    express_server.get('/sendFiatVia/:OfferId', sendFiatVia);
}

function index(req, res) {
    return display(req, res, 'index');
}

function display(req, res, page, args) {
    args = args || {};
    args.user = req.session.user || {};
    args.API = req.session.API || '';
    args.API_KEY = req.session.API_KEY || '';
    args.USERNAME = req.session.USERNAME || '';
    args.EMAIL = req.session.EMAIL || '';
    args.uid = req.session.uid || '';
    args.client_id = req.session.client_id || '';
    args.AccountID = req.session.client_id || '';
    args.wallet = req.session.wallet || '';
    args.reflink = req.session.reflink || '';
    return res.render(page, args);
}

function logIn(req, res) {
    //console.log(req.body);
    if (!req.body.EMAIL)
        return err(res, ERR_CODE_EMAIL_MISSING, 'ERR_CODE_EMAIL_MISSING');
    if (!req.body.PASSWORD)
        return err(res, ERR_CODE_PASSWORD_MISSING, 'ERR_CODE_PASSWORD_MISSING');

    // WARNING: do not try to create too much account.
    // You get blocked by DDoS protection.
    // TTL: 1 account per minute.

    // to raise this limit, ask: talk-with@bitex.gg

    let ACCOUNT = {};
    ACCOUNT.user = g(req.body.EMAIL);
    ACCOUNT.pass = io.sha256(g(req.body.PASSWORD, io.uuid()));
    ACCOUNT.__AUTH_API = io.md5(req.body.EMAIL); // gen from email
    ACCOUNT.API_KEY = ACCOUNT.pass;
    console.log(ACCOUNT);

    io.GET('/api/v1/public/wallet_user_auth', function (result) {
        console.log('result', result);

        if (!result.OK) {
            req.session = {};
            io.red('OK=' + result.OK + ') ' + result.OK_STR);
            return api_response(res, result, result.OK, result.OK_STR);
        }

        // login ok.
        req.session.API = ACCOUNT.__AUTH_API;
        req.session.API_KEY = ACCOUNT.API_KEY;
        req.session.USERNAME = result.name;
        req.session.EMAIL = result.email;
        req.session.uid = result.uid;
        req.session.client_id = result.client_id;
        req.session.wallet = result.wallet;
        req.session.reflink = result.reflink;
        io.green('LOGIN ' + result.name + ' ' + result.email);

        API(req, res, 'auth.api_account_profile', [req.session.uid],
            function (user_profile) {
                req.session.user = user_profile;
                console.log('req.session.user', req.session.user);
                return api_response(res, result, result.OK, result.OK_STR);
            }, false, false, true, 0);

    }, ACCOUNT);

}

function signOff(req, res) {
    req.session.destroy();
    return api_response(res, {}, 1, 'Sign-off completed. Please, redirect.');
}

/**
 * Secure WebSocket endpoint to connect to BitEx network.
 * Use io.publicEndpoints to fetch an list of endpoints and store it.
 * @param debug
 * @constructor
 */
function ENDPOINTS_SETUP(debug) {
    if (debug) {
        // this is developer env
        if (debug) io.red('**LOCALHOST DEV!** DISABLED IT! WILL NOT WORK.');
        io.publicEndpoint('localhost');
    } else {
        io.publicEndpoint('api.bitex.gg');
        //io.publicEndpoints(console.log);
    }

}

function get_io() {
    return io;
}


function api_err(req, res, message, details) {
    const err = {success: false, message: message, details: details};
    return res.json(err);
}

function api_call(req, res) {
    const app = req.params.app;
    if (!app) {
        return api_err(req, res, 'Invalid API', 'No application to load.');
    }

    let app_id = app;

    const uid = (req.user && req.user.uid) ? req.user.uid : 0;
    const is_auth = (req.user && req.user.uid) ? true : false;
    const is_dev = (req.user && req.user.acl.indexOf('ACL_DEV') !== -1) ? true : false;
    const is_adm = (req.user && req.user.acl.indexOf('ACL_ADMIN') !== -1) ? true : false;

    if (app_id.indexOf('api_') === -1) {
        return api_err(req, res, 'NO api_ PREFIX', 'NOT ALLOWED, API MUST START WITH api_.');
    }

    if (!is_auth && app_id.indexOf('public_') === -1) {
        return api_err(req, res, 'NO public_ PREFIX', 'NOT ALLOWED, API MUST START WITH public_.');
    }

    if (app_id.indexOf('api_adm_') !== -1) {
        if (is_dev && !is_adm) {
            console.log('acl:', is_dev, is_adm);
            console.log('user:', req.user);
            return api_err(req, res, 'APP [' + app + '] ADMIN ONLY', 'NOT ALLOWED, ADMIN ONLY APP.');
        }
    }

    if (app_id.indexOf('api_dev_') !== -1) {
        if (!is_dev)
            return api_err(req, res, 'APP [' + app + '] DEV ONLY', 'NOT ALLOWED, DEV ONLY APP.');
    }

    const args = [uid, req.ip];
    io.api(app_id, args, function (result) {
        return res.json({success: true, result: result});
    }, is_dev);
}

function g(v, d) {
    d = d ? d : '';
    return v ? v : d;
}

function err(res, code, message) {
    const str = {success: false, code: code, message: message};
    return res.json(str);
}

function newAccount(req, res) {

    let args = {};
    args.TYPE = 'new';
    args.USERNAME = 'U' + io.timestamp();
    args.DISCORD = args.USERNAME;
    args.TELEGRAM = args.USERNAME;
    args.EMAIL = args.USERNAME + '@example.com';
    args.LANG = 'pt-BR';
    args.COUNTRY = '076';
    args.PASSWORD = io.sha256(io.uuid());

    return display(req, res, 'newAccount', args);
}

function editAccount(req, res) {

    const args = [req.session.uid];
    API(req, res, 'auth.api_account_profile', args, function (r) {
        console.log(r);

        let args = r;
        args.TYPE = 'edit';
        args.USERNAME = r.user_name;
        args.EMAIL = r.user_email;
        args.DISCORD = r.user_discord;
        args.TELEGRAM = r.user_telegram;
        args.LANG = r.user_lang;
        args.COUNTRY = r.user_country;
        args.PASSWORD = '';

        return display(req, res, 'editAccount', args);

    }, false, false, true, 0);
}

function accountProfile(req, res) {
    const args = [req.session.uid];
    API(req, res, 'auth.api_account_profile', args, function (r) {
        console.log(r);
        return display(req, res, 'accountProfile', r);
    }, false, false, true, 0);
}

let DEPOSIT_ADDRESS_GEN = 0;// on first call, generate deposit addresses
function accountBalances(req, res) {
    let rpc_id = 'ex.api_account_ex_addr';
    if (!DEPOSIT_ADDRESS_GEN)
        rpc_id = 'ex.api_account_critical_ex_addr';
    API(req, res, rpc_id, [1], function (tree) {
        DEPOSIT_ADDRESS_GEN = 1;
        let r = {};
        r.tree = tree;
        //console.log(r);
        return display(req, res, 'accountBalances', r);
    });
}

const ERR_CODE_USERNAME_MISSING = 1002;
const ERR_CODE_EMAIL_MISSING = 1003;
const ERR_CODE_PASSWORD_MISSING = 1004;
const ERR_CODE_PASSWORD_NOT_EQUAL = 1004.1;
const ERR_CODE_SESSION_MISSING = 1005;
const ERR_CODE_SESSION_API_MISSING = 1006;
const ERR_CODE_SESSION_CID_MISSING = 1007;
const ERR_CODE_ACCOUNT_UPDATE = 1008;

function API(req, res, proc_id, args, callback, debug, ignore_error, is_gr, cache_ttl) {
    if (!req.session)
        return err(res, ERR_CODE_SESSION_MISSING, 'ERR_CODE_SESSION_MISSING');
    if (!req.session.API)
        return err(res, ERR_CODE_SESSION_API_MISSING, 'ERR_CODE_SESSION_API_MISSING');
    if (!req.session.client_id)
        return err(res, ERR_CODE_SESSION_CID_MISSING, 'ERR_CODE_SESSION_CID_MISSING');

    const _API = req.session.API;
    const _API_KEY = req.session.API_KEY;
    const _client_id = req.session.client_id;
    io.api(_API, _API_KEY, _client_id, proc_id, args, callback, debug, ignore_error, is_gr, cache_ttl);
}


function updateAccount(req, res) {

    console.log(req.body);

    if (!req.body.USERNAME)
        return err(res, ERR_CODE_USERNAME_MISSING, 'ERR_CODE_USERNAME_MISSING');
    if (!req.body.EMAIL)
        return err(res, ERR_CODE_EMAIL_MISSING, 'ERR_CODE_EMAIL_MISSING');
    if ((req.body.PASSWORD && !req.body.PASSWORD1) || (!req.body.PASSWORD && req.body.PASSWORD))
        return err(res, ERR_CODE_PASSWORD_MISSING, 'ERR_CODE_PASSWORD_MISSING');
    if (req.body.PASSWORD && req.body.PASSWORD !== req.body.PASSWORD1)
        return err(res, ERR_CODE_PASSWORD_NOT_EQUAL, 'ERR_CODE_PASSWORD_NOT_EQUAL');

    io.magenta('-- SAMPLE ACCOUNT UPDATE --');

    // email | [google|discord|site] | site
    let email = ["add_hash", req.body.EMAIL + '12'];

    let args = [];
    args.push(req.session.uid);
    args.push(req.body.USERNAME);
    args.push(req.body.EMAIL);
    args.push(email);
    args.push(req.body.DISCORD);
    args.push(req.body.TELEGRAM);
    args.push(req.body.COUNTRY);

    let password = '';
    if (req.body.PASSWORD)
        password = ["pre_pwd", io.sha256(g(req.body.PASSWORD, io.uuid()))];

    args.push(password);

    API(req, res, 'auth.api_account_profile_update', args, function (r) {
        const ok = r.ok;
        if (!ok) {
            const message = 'ERR_CODE_ACCOUNT_UPDATE: ' + r.str;
            return err(res, ERR_CODE_ACCOUNT_UPDATE, message);
        }

        // update profile, to prevent old info on interface...
        API(req, res, 'auth.api_account_profile', [req.session.uid],
            function (user_profile) {
                req.session.user = user_profile;
                console.log('req.session.user', req.session.user);
                return api_response(res, r, ok);
            }, false, false, true, 0);

    }, false, false, true, 0);

}

function saveNewAccount(req, res) {
    console.log(req.body);
    if (!req.body.USERNAME)
        return err(res, ERR_CODE_USERNAME_MISSING, 'ERR_CODE_USERNAME_MISSING');
    if (!req.body.EMAIL)
        return err(res, ERR_CODE_EMAIL_MISSING, 'ERR_CODE_EMAIL_MISSING');
    if (!req.body.PASSWORD)
        return err(res, ERR_CODE_PASSWORD_MISSING, 'ERR_CODE_PASSWORD_MISSING');

    // WARNING: do not try to create too much account.
    // You get blocked by DDoS protection.
    // TTL: 1 account per minute.

    // to raise this limit, ask: talk-with@bitex.gg

    let ACCOUNT = {};
    ACCOUNT.username = g(req.body.USERNAME);
    ACCOUNT.email = g(req.body.EMAIL);
    ACCOUNT.password = io.sha256(g(req.body.PASSWORD, io.uuid()));
    ACCOUNT.__AUTH_API = io.md5(req.body.EMAIL); // gen from email
    ACCOUNT.API_KEY = ACCOUNT.password;

    ACCOUNT.lang = g(req.body.LANG, 'pt-BR');
    ACCOUNT.country_id = g(req.body.COUNTRY_ID, '076'); // bitex.publicCountries
    ACCOUNT.contry = g(req.body.COUNTRY, 'Brazil');
    ACCOUNT.telegram = g(req.body.TELEGRAM, '');
    ACCOUNT.discord = g(req.body.DISCORD, '');
    ACCOUNT.reflink = g(req.body.REFLINK, '1');
    ACCOUNT.tz = g(req.body.TIMEZONE, '-3');
    ACCOUNT.ts = g(req.body.TIMESTAMP, io.timestamp());
    ACCOUNT.version = g(req.body.VERSION, '1');

    //req.session.user = ACCOUNT;
    //console.log('req.body', req.body);
    //console.log('ACCOUNT', ACCOUNT);

    //return res.json(ACCOUNT);
    //return response(res, {}, 0, 'TEST');

    io.GET('/api/v1/public/signup', function (result) {
        console.log('result', result);
        const success = result.err ? 0 : 1;
        if (success) {
            req.session.ACCOUNT = result;
            req.session.API = ACCOUNT.__AUTH_API;
            req.session.API_KEY = ACCOUNT.API_KEY;
            req.session.USERNAME = ACCOUNT.username;
            req.session.EMAIL = ACCOUNT.email;
            req.session.uid = result.uid;
            req.session.client_id = result.client_id;
            req.session.wallet = result.wallet;
            req.session.reflink = result.reflink;
        } else {
            req.session = {};
        }
        return api_response(res, result, success, result.details);
    }, ACCOUNT);

}

function api_response(res, data, success, message) {
    if (!success)
        io.red(message);

    let r = {};
    r.success = success;
    if (success) {
        r.result = data;
    } else {
        r.message = message;
        io.red('API BACKEND ERROR: ' + message);
    }
    return res.json(r);
}

function Faucet(req, res) {
    const args = [req.query.Symbol, req.query.Amount];
    API(req, res, 'ex.api_account_critical_faucet', args, function (r) {
        const err = r.err;
        const str = r.str;
        const BalanceId = r._balance_id;
        //console.log(res);
        if (err > 0) {
            io.red('Faucet ' + req.query.Symbol + '=' + req.query.Amount + ' ERROR: ' + str);
        } else {
            io.green('Faucet OK: ' + req.query.Symbol + '=' + req.query.Amount + ': ' + str);
        }
        // ok, now, update balances
        return accountBalances(req, res);
    });
}


function sendMoneyTo(req, res) {
    let r = {};
    r.Symbol = req.params.Symbol;
    r.TransactionId = io.sha256(io.uuid());
    //console.log(r);
    return display(req, res, 'sendMoneyTo', r);
}

function sendMoneyToExec(req, res) {
    const FromBalance_id = req.params.FromBalance_id;
    const DestinationAccountId = req.body.DestinationAccountId;
    const Amount = req.body.Amount;
    const TransactionId = req.body.TransactionId;
    console.log(req.body);
    let args = [];
    args.push(FromBalance_id);
    args.push(DestinationAccountId);
    args.push(Amount);
    args.push(TransactionId);

    API(req, res, 'ex.api_account_critical_ex_transfer', args, function (result) {
        const err = result.status;
        const str = result.str;
        const success = err ? 0 : 1;
        if (err) {
            io.red(str);
        }
        io.green('Transfer of ' + FromBalance_id + '=' + Amount + ': "' + str + '"');
        return api_response(res, result, success, str);
    }, false, false, true, 0);

}


function sendFiat(req, res) {
    const country = '';
    const currency = '';
    io.myLocalGateways(country, currency, function (result) {
        let r = {};
        r.result = result;
        //console.log(result);
        return display(req, res, 'sendFiat', r);
    });
}

function sendFiatVia(req, res) {
    const type_public_offer = 0;//
    const offer_id = req.params.OfferId;
    const first_request = 1; // just log this trade
    const args = [type_public_offer, offer_id, first_request];
    API(req, res, 'payment.api_account_gw_by_id', args, function (r) {
        r.gw_terms = io.nl2br( sanitizeHtml(r.gw_terms, sanitizeHtml_config).trim() );
        r.fee = r.gw_fee+r.gw_fee_platform;
        console.log(r);
        return display(req, res, 'sendFiatVia', r);
    }, false, false, true, 0);
}