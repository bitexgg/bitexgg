"use strict";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const VERSION = 0.2;
const DEV_ENV = 1;
let ENDPOINT = 'api.bitex.gg'; // choose a router near you
const WSS_PROTO = 'wss';
const WSS_PORT = 443;
const UUID = require('uuid');

const WebSocketClient = require('websocket').client;
const client = new WebSocketClient({autoConnect: true});

let API, API_KEY, CALLBACK, CACHE = {};
let config_loaded = false;
let AUTH; // keep data of authenticated user

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

let CONFIG_DATA = {};

module.exports = {
    init: init,
    publicEndpoint: publicEndpoint,
    publicEndpoints: publicEndpoints,
    connect: connect,
    api: api,
    critical: tx,
    red: red,
    blue: blue,
    magenta: magenta,
    green: green,
    yellow: yellow,
    white: white,
    cat: on_cat,
    put: on_put,
    exists: exists,
    writeable: writeable,
    GET: GET,
    publicCountries: publicCountries,
    publicAccountCreate: publicAccountCreate,
    publicAccountUpdate: publicAccountUpdate,
    uuid: uuid,
    sha256: sha256,
    md5: md5,
    timestamp: timestamp,
    timezone: timezone,
    locale: locale,
    language: language,
    authData: authData,
    accountBalances: accountBalances,
    SymbolOf: SymbolOf,
    BalanceIdOfSymbol: BalanceIdOfSymbol,
    Faucet: Faucet,
    sendMoneyTo: sendMoneyTo,
    on: on,
    balanceHistoryDeposits: balanceHistoryDeposits,
    balanceHistoryWithdraw: balanceHistoryWithdraw,
    cfg: cfg,
    nl2br: nl2br,
    myLocalGateways: myLocalGateways
};

let API_DEBUG = false;
let CONFIG_FILE_NAME;

function init(path, arg_debug) {
    if (!path) {
        red('FATAL: NO FILE NAME PASSED TO init TO LOAD CONFIGURATION.');
    } else {
        CONFIG_FILE_NAME = path;
    }
    API_DEBUG = arg_debug;
    // load config, to check if we have api key stored.

    config_load();
    let SECRET = cfg('SECRET');
    if (!SECRET) {
        SECRET = sha256(uuid());
        config_save('SECRET', SECRET);
        yellow('NO SECRET FOUND, GENERATING NEW ONE TO USE ON COOKIES... ' + SECRET);
    }
}

function locale() {
    let l = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || process.env.LANGUAGE;
    if (!l) return 'us';
    if (l.indexOf('.') != -1)
        l = l.split('.')[0];
    if (l.indexOf('_') != -1)
        l = l.split('_')[1];
    if (!l) return 'us';
    return l.toLowerCase();
}

function language() {
    let l = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || process.env.LANGUAGE;
    if (!l) return 'en';
    if (l.indexOf('.') != -1)
        l = l.split('.')[0];
    return l.toLowerCase();
}

function uuid() {
    return UUID.v4();
}

function sha256(str) {
    return crypto.createHash('sha256')
        .update(str).digest('hex');
}

function md5(str) {
    return crypto.createHmac('md5', str).digest('hex');
}

function timestamp() {
    return Math.round((new Date()).getTime() / 1000);
}

function timezone() {
    const tz = -(new Date().getTimezoneOffset() / 60);
    return tz;
}

function publicEndpoint(arg_endpoint) {
    if (!arg_endpoint)
        return red('STOP: EMPTY ENDPOINT!');

    if (ENDPOINT == arg_endpoint)
        return;

    yellow('ENDPOINT CHANGED FROM ' + ENDPOINT + ' TO ' + arg_endpoint);
    ENDPOINT = arg_endpoint;
    config_save('ENDPOINT', ENDPOINT);
}

function connect(arg_cb, arg_api, arg_api_key, debug) {

    if (arg_api) {
        if (debug) yellow('-USING API FROM ARG: ' + arg_api);
        API = arg_api;
    }
    if (arg_api_key) {
        if (debug) yellow('-USING API_KEY FROM ARG.');
        API_KEY = arg_api_key;
    }
    CALLBACK = arg_cb;

    const config_endpoint = cfg('ENDPOINT');
    if (config_endpoint) {
        if (debug) yellow('ENDPOINT ' + ENDPOINT + ' LOADED FROM ' + CONFIG_FILE_NAME);
        ENDPOINT = config_endpoint;
    }

    if (!API) {
        if (debug) yellow('-NO API, TRYING TO GET FROM CONFIG...');
        API = cfg('API');
    }

    if (!API) {
        red('FATAL: NO API AS FISRT ARGUMENT AND NO API ON ' + CONFIG_FILE_NAME + '. RUN AS:');
        red('nodemon indjex.js 32-CHAR-API 64-CHAR-API-KEY');
        red('- OR USE publicAccountCreate(...) TO GENERATE API+API_KEY PAIR.');
        process.exit(1);
    } else {
        // store this API for future use
        if (!cfg('API'))
            config_save('API', API);
    }

    if (!API_KEY) {
        if (debug) yellow('-NO API_KEY, TRYING TO GET FROM CONFIG...');
        API_KEY = cfg('API_KEY');
    }

    if (!API_KEY) {
        red('FATAL: NO API_KEY AS SECOND ARGUMENT AND NO API ON ' + CONFIG_FILE_NAME + '. RUN AS:');
        red('nodemon indjex.js 32-CHAR-API 64-CHAR-API-KEY');
        red('- OR USE publicAccountCreate(...) TO GENERATE API+API_KEY PAIR.');
        process.exit(1);
    } else {
        if (!cfg('API_KEY'))
            config_save('API_KEY', API_KEY);
    }

    ws_init(WSS_PROTO + '://' + ENDPOINT + ':' + WSS_PORT);

}


// ------------------------------------------------------------
// FROM HERE API TO CONNECT USING WSS AND AUTHENTICATE
// ------------------------------------------------------------
let fd;
let FD_INDEX = 0;

function ws_init(url) {
    client.on('connectFailed', function (error) {
        console.log('FATAL: CONNECT - ' + url, error.toString());
        process.exit(3);
    });

    client.on('connect', function (arg_fd) {
        fd = arg_fd;
        FD_INDEX = FD_INDEX++;
        fd.API = API;
        fd.API_KEY = API_KEY;
        fd.on('error', function (error) {
            //disconnected(fd);
            console.log('EXIT: ', error);
            process.exit(1);
        });
        fd.on('close', function () {
            console.log('FATAL: CLOSED.');
            process.exit(2);
            //disconnected(fd);
        });
        fd.on('message', function (message) {
            if (message.type === 'utf8') {
                router(fd, JSON.parse(message.utf8Data));
            } else {
                console.warn("[fd] Unknown Received: " + message);
            }
        });
    });

    client.connect(url, '', API);


}

function fd_hmac(r) {
    if (!fd.API && !fd.API_KEY) {
        fd.AUTH_ERROR = 0;
        yellow(fd.DEBUG_ID + '> ! fd.API && ! fd.API_KEY');
        return true;
    }
    if (!r.HMAC) {
        fd.AUTH_ERROR = 1;
        red(fd.DEBUG_ID + '> HMAC ERROR - !r.HMAC');
        return false;
    }
    if (!r.__AUTH_TIME) {
        fd.AUTH_ERROR = 1;
        red(fd.DEBUG_ID + '> HMAC ERROR - !r.__AUTH_TIME');
        return false;
    }
    let hmac_arg = [];
    hmac_arg.push(r.module_id);
    hmac_arg.push(r.event_id);
    hmac_arg.push(r.client_id);
    hmac_arg.push(r.__AUTH_TIME);
    hmac_arg.push(r.__ENV_TEST);
    hmac_arg.push(fd.API);

    const REMOTE_HMAC = r.HMAC;
    const HMAC_SOURCE = hmac_arg.join('/');
    const COMPUTED_HMAC = crypto.createHmac('sha256', fd.API_KEY)
        .update(HMAC_SOURCE).digest('hex');
    if (REMOTE_HMAC != COMPUTED_HMAC) {
        fd.AUTH_ERROR = 1;
        yellow('> HMAC ERROR - REMOTE_HMAC != COMPUTED_HMAC');
        yellow('> - HMAC_SOURCE       : ' + HMAC_SOURCE);
        if (r.HMAC_SRC) {
            yellow('> - HMAC_SOURCE_REMOTE: ' + r.HMAC_SRC);
        }
        yellow('> - REMOTE_HMAC: ' + REMOTE_HMAC);
        yellow('> - COMPUTED_HMAC: ' + COMPUTED_HMAC);
        return false;
    }
    const OUR_TIME = (timestamp() + 5);
    const TIME_DIFF = OUR_TIME - r.__AUTH_TIME;
    if (TIME_DIFF > 600 || r.__AUTH_TIME <= 1532549584) {
        req.AUTH_ERROR = 1;//
        io.die(fd, fd.DEBUG_ID + '> HMAC ERROR - !TIME_DIFF ERROR. ADJUST YOU CLOCK.');
        return false;
    }
    fd.AUTH_ERROR = 0;
    return true;
}

function router(fd, res) {
    //console.log(res);
    const module_id = res.module_id;
    const event_id = res.event_id;
    if (fd.id) {
        if (!fd_hmac(res)) {
            red(' - client router - STOP - HMAC error.');
            return;
        }
    }
    if (!module_id || !event_id) {
        red(' - client router - STOP - ' + module_id + '.' + event_id + ' - ! event_id.');
        return;
    }
    if (fd.AUTH_ERROR) {
        red('req.AUTH_ERROR');
        return;
    }
    const data = res.data;
    if (module_id == 'auth') {
        router_auth(fd, event_id, data);
    } else if (module_id == 'system') {
        //console.log(res);
        router_system(fd, event_id, res);
    } else {
        route_local(fd, event_id, data, res);
    }
}

function router_auth(fd, event_id, data) {
    if (event_id == 'auth_status') {
        auth_status(fd, data);
    } else {
        red(' - client router_auth - STOP - ' + event_id + ' - not implemented');
        console.log(data);
    }
}

function auth_status(arg_fd, r) {
    AUTH = r;
    //console.log(AUTH);
    arg_fd.id = AUTH.client_id;
    arg_fd.client_id = AUTH.client_id;
    fd = arg_fd;
    yellow('---------------------------------------------------');
    yellow('[BitEx.gg websocket online] client_id=' + fd.client_id);
    yellow('####################################################');
    accountBalances(function (Balances) {
        if (CALLBACK) CALLBACK(AUTH, Balances);
    });
}

function route_local(fd, event_id, data, res) {
    const MODULE = res.module_id;
    const EVENT = res.event_id;
    const OP = res.ev_op;
    if (MODULE == 'broadcast') {
        on_broadcast_received(OP, data);
    } else {
        yellow(' - client router - STOP - module - not implemented:');
        yellow(' -- module_id=' + MODULE);
        yellow(' -- event_id=' + EVENT);
        console.log(res);
        console.log(data);
    }
}

function on_broadcast_received(ev, data) {
    const cache = on_event_cache[ev];
    if (ev == 'balance_change') {
        const BalanceId = data.balance_id;
        const Amount = data.balance_amount;
        on_balance_changed(BalanceId, Amount);
    } else {
        if (!cache) {
            yellow('BROADCAST RECEIVED AND NOT IMPLEMENTED: ' + ev + ' AND NOT IN cache.');
            yellow(data);
        }
    }

    if (cache) {
        for (let i in cache) {
            cache[i](data);
        }
    }
}


let on_event_cache = {};

function on(event_id, cb) {
    if (!event_id) return red('on error: no event_id.');
    if (!cb) return red('on error: no callback.');
    //console.log('on', event_id, cb.name);
    let cache = on_event_cache[event_id] || [];
    cache.push(cb);
    on_event_cache[event_id] = cache;
}

//
let app_callback;

let call_cb = {};

function fd_cb(i, r) {
    //console.log(i,r);
    if (call_cb[i]) {
        const cb = call_cb[i];
        delete call_cb[i];
        cb(r);
    }
}

function call(proc_id, args, callback, debug, ignore_error, is_gr, cache_ttl) {
    fd_call(fd, fd.API, fd.API_KEY, fd.client_id, proc_id, args, callback, debug, ignore_error, is_gr, false, cache_ttl);
}

function tx(proc_id, args, callback, debug, ignore_error, is_gr, cache_ttl) {
    fd_call(fd, fd.API, fd.API_KEY, fd.client_id, proc_id, args, callback, debug, ignore_error, is_gr, true, cache_ttl);
}

function cache(cache_ttl, proc_id, args, callback, debug) {
    fd_call(fd, fd.API, fd.API_KEY, fd.client_id, proc_id, args, callback, debug, false, false, false, cache_ttl);
}

function cache_gr(cache_ttl, proc_id, args, callback, debug) {
    fd_call(fd, fd.API, fd.API_KEY, fd.client_id, proc_id, args, callback, debug, false, true, false, cache_ttl);
}

function gr(proc_id, args, callback, debug, ignore_error, cache_ttl) {
    call(proc_id, args, callback, debug, ignore_error, true, cache_ttl);
}


function format_args(args) {
    // for HMAC AUTH ORDER
    let l = [];
    for (let i in args) {
        l.push(args[i]);
    }
    return l;
}

function call_exec_error(fd, cb, data) {
    const err_id = data[0];
    const err_h1 = data[1];
    const err_h2 = data[2];
    console.log('call_exec_error --------------------------------------------------------');
    console.log(err_id, err_h1);
    console.log(err_h2);
    console.log('call_exec_error --------------------------------------------------------');
    delete call_cb[cb];
}

function timestamp() {
    return Math.round((new Date()).getTime() / 1000);
}


const colors = {
    Reset: "\x1b[0m",
    Bright: "\x1b[1m",
    Dim: "\x1b[2m",
    Underscore: "\x1b[4m",
    Blink: "\x1b[5m",
    Reverse: "\x1b[7m",
    Hidden: "\x1b[8m",
    fg: {
        Black: "\x1b[30m",
        Red: "\x1b[31m",
        Green: "\x1b[32m",
        Yellow: "\x1b[33m",
        Blue: "\x1b[34m",
        Magenta: "\x1b[35m",
        Cyan: "\x1b[36m",
        White: "\x1b[37m",
        Crimson: "\x1b[38m"
    },
    bg: {
        Black: "\x1b[30m",
        Red: "\x1b[41m",
        Green: "\x1b[42m",
        Yellow: "\x1b[43m",
        Blue: "\x1b[44m",
        Magenta: "\x1b[45m",
        Cyan: "\x1b[46m",
        White: "\x1b[47m",
        Crimson: "\x1b[48m"
    }
};

function blue(...args) {
    console.log(colors.fg.Blue, ...args, colors.Reset);
}

function red(...args) {
    console.log(colors.fg.Red, ...args, colors.Reset);
}

function green(...args) {
    console.log(colors.fg.Green, ...args, colors.Reset);
}

function yellow(...args) {
    console.log(colors.fg.Yellow, ...args, colors.Reset);
}

function magenta(...args) {
    console.log(colors.fg.Magenta, ...args, colors.Reset);
}

function white(...args) {
    console.log(colors.fg.White, ...args, colors.Reset);
}

function api(_API, _API_KEY, _client_id, proc_id, args, callback, debug, ignore_error, is_gr, cache_ttl) {
    console.log(proc_id, args);
    fd_call(fd, _API, _API_KEY, _client_id,
        proc_id, args, callback, debug, ignore_error, is_gr, false, cache_ttl);
}

function fd_call(fd, _API, _API_KEY, _client_id,
                 id, args, callback, debug, ignore_error, is_gr, is_tx, cache_ttl) {

    const ts = (new Date()).getTime();
    const ttl = Math.round(ts);
    let i = 0;
    const call_args = format_args(args);
    const str = id + " ['" + args.join("','") + "']";
    if (callback || cache_ttl > 0) {
        i = UUID.v4();
        call_cb[i] = [callback, debug, ignore_error, is_gr, is_tx, ttl, str, parseInt(cache_ttl)];
    }
    const arg = [id, call_args, i, debug, ignore_error, is_gr, is_tx, ttl];
    if (cache_ttl > 0) {
        const NOW = Math.round(ts / 1000);
        const r = CACHE[str];
        if (r) {
            const UNTIL = r[0];
            const DIFF = NOW - UNTIL;
            //green('CACHE STATUS> DIFF=' + DIFF + ' UNTIL=' + UNTIL + ' NOW=' + NOW);
            if (DIFF <= 0) {
                const result = r[1];
                //green('CACHE USE> ' + str);
                if (callback)
                    callback(result, true);
                if (call_cb[i])
                    delete call_cb[i];
                return;
            }
        }
    }
    if (debug) {
        yellow('DEBUG> API' + _API + ' client_id=' + _client_id);
        let strlog = 'wss-rpc> ' + str;
        if (cache_ttl)
            green('CACHED: ' + strlog);
        else
            red('NO-CACHE: ' + strlog);
        if (callback)
            call_cb[i][1] = str; // debug
    }
    emit(fd, _API, _API_KEY, _client_id, 'system', 'call', arg, debug);
}

function system_callback(fd, cb, data) {
    //console.log('system_callback cb', cb);
    //console.log('system_callback data', data);
    if (!cb) return;
    const args = call_cb[cb];
    const callback = args[0];
    const debug = args[1];
    const ignore_error = args[2];
    const is_gr = args[3];
    //const is_tx = args[4];

    if (debug) {
        const res_ttl = args[5];
        const ts = Math.round((new Date()).getTime());
        const ttl = ts - res_ttl;
        if (ttl >= 5000) {
            const debug_str = "\tTTL WARNING> " + debug + ' -- ' + ttl;
            red(debug_str);
        } else {
            //const debug_str = "\tTTL OK> "+debug+' -- '+ttl;
            //green(debug_str);
        }
    }

    let result = data;
    if(is_gr && result && result[0])
        result = result[0]; // one row only

    const cache_ttl = args[7];
    if (cache_ttl > 0) {
        const cache_id = args[6];
        const SEC = Math.round((new Date()).getTime() / 1000);
        let UNTIL = (SEC + cache_ttl);
        //console.log('CACHE SET> ', UNTIL, cache_id);
        CACHE[cache_id] = [UNTIL, result];
    }

    if (callback)
        callback(result, true);

    if (call_cb[cb])
        delete call_cb[cb];

}


function emit(fd, _API, _API_KEY, _client_id, module_id, event_id, data, debug, arg_r) {
    if (!fd) {
        console.log(' FD ERROR OFFLINE.');
        return;
    }
    let r = arg_r || {};
    if (!module_id) {
        console.log('> emit error> ! module_id');
        return;
    }
    if (!event_id) {
        console.log('> emit error> ! event_id');
        return;
    }
    if (!_API) {
        console.log('> emit error> ! _API');
        return;
    }
    if (!_API_KEY) {
        console.log('> emit error> ! _API_KEY');
        return;
    }
    r.module_id = module_id;
    r.event_id = event_id;
    r.client_id = _client_id;
    r.ts = timestamp();
    r.t = 2; //2: multiple api per connection
    r.__ENV_TEST = DEV_ENV ? 1 : 0; //show rpc calls
    r.session_id = 1; // use client_id insteand of user_uid
    r.API = _API; // use client_id insteand of user_uid
    if (data && data[2])
        r.event = data[2];
    let HMAC_STR;
    if (_API && _API_KEY) {
        let hmac_arg = [];
        hmac_arg.push(r.module_id);
        hmac_arg.push(r.event_id);
        hmac_arg.push(_client_id);
        hmac_arg.push(r.ts);
        hmac_arg.push(r.t);
        hmac_arg.push(_API);
        if (data[1])
            hmac_arg.push(JSON.stringify(data[1]));

        HMAC_STR = hmac_arg.join('/');
        //console.log(str);

        r.HMAC = crypto.createHmac('sha256', _API_KEY)
            .update(HMAC_STR).digest('hex');
    }
    if (!data) {
        data = {};
    }
    r.data = data;
    const str = JSON.stringify(r);
    if (debug) {
        yellow('> _API=' + _API + ' =_API_KEY' + _API_KEY);
        yellow('> _API_KEY=' + _API_KEY);
        yellow('> r.HMAC=' + r.HMAC);
        yellow('> HMAC_STR=' + HMAC_STR);
        console.log(str);
        //console.log(r);
        //magenta( '> EMIT '+debug_id+'@'+module_id+'.'+event_id+' < -----------------------------------------------------------');
    }
    fd.send(str);
}

function router_system(fd, event_id, res) {
    const data = res.data;
    const cb = res.event;
    if (event_id == 'log') {
        red('CLINET SYSTEM LOG> ', data);
    } else if (event_id == 'callback') {
        system_callback(fd, cb, data);
    } else if (event_id == 'call_exec_error') {
        call_exec_error(fd, cb, data);
    } else {
        red(' - client router_system - STOP - ' + event_id + ' - not implemented');
        console.log(data);
    }

}

function on_cat(file) {
    if (!exists(file)) return '';
    return fs.readFileSync(file, 'utf8');
}

function on_put(file, str) {
    if (exists(file) && !writeable(file)) return false;
    fs.writeFile(file, str, function (e) {
        if (e) red('ERROR: FILE="' + file + '" ' + e);
    });
    return true;
}


function exists(file) {
    try {
        return fs.existsSync(file);
    } catch (e) {
        return false;
    }
}

function writeable(what) {
    try {
        fs.accessSync(what, fs.constants.R_OK | fs.constants.W_OK);
        return true;
    } catch (err) {
        red('IS WRITEABLE CHECK OF "' + what + '": NO WRITABLE!');
        return false;
    }
}

function config_save(key, value) {
    const config_ok = writeable(__dirname);
    CONFIG_DATA[key] = value;
    if (!config_ok) {
        yellow('Dir: ' + __dirname + ' is not writable.');
        return false;
    } else {
        const str = JSON.stringify(CONFIG_DATA);

        return on_put(CONFIG_FILE_NAME, str);
    }
}

function cfg(key) {
    return CONFIG_DATA[key];
}

function config_load() {
    if (config_loaded) return;
    config_loaded = true;
    let str = '{}';
    if (!exists(CONFIG_FILE_NAME)) {
        console.log('- Config: ' + CONFIG_FILE_NAME + ' not found, loading empty config.');
    } else {
        console.log('- Loading config: ' + CONFIG_FILE_NAME);
        str = on_cat(CONFIG_FILE_NAME) || '{}';
    }

    CONFIG_DATA = JSON.parse(str);

    if (CONFIG_DATA.ENDPOINT) {
        ENDPOINT = CONFIG_DATA.ENDPOINT;
        console.log('- ENDPOINT: ' + ENDPOINT);
    }

    if (CONFIG_DATA.API) {
        API = cfg('API');
    }

    if (CONFIG_DATA.API_KEY)
        API_KEY = cfg('API_KEY');

    //console.log(CONFIG_DATA);
    return CONFIG_DATA;
}

function GET(uri, cb, args) {
    let q = '';
    if (args) {
        let arr = [];
        for (let key in args) {
            arr.push(key + '=' + args[key]);
        }
        q = '?' + arr.join('&');
    }

    const url = 'https://' + ENDPOINT + ':' + WSS_PORT + uri + q;
    if (API_DEBUG)
        yellow('API DEBUG> ' + url);
    const headers = {
        'User-Agent': 'v2/bih/' + VERSION + '/' + API + '/us/en',
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    const options = {
        method: 'GET',
        headers: headers
    };

    https.get(url, options, function (res) {
        let data = '';
        res.on('data', function (d) {
            data += d.toString('utf8');
        });

        res.on('end', function () {
            //console.log(data);
            let json = data ? JSON.parse(data) : '{}';
            if (json.success === false) {
                red('STOP: ERROR "' + json.result.err + '" ON REQUEST ' + uri);
                return; // we just return, you can implement your error here.
            }
            let tree = json.result ? json.result : json;
            if (cb) cb(tree, res);
        });
    }, headers).on('error', function (err) { // Handle errors
        red('-- wget ERROR: ', url, err.message);
        //if (cb) cb(undefined, undefined, err.message);
    });
}

function publicCountries(cb) {
    GET('/api/v1/public/country', cb);
}

function publicCurrencies(cb) {
    GET('/api/v1/public/currencies', cb);
}

function publicEndpoints(cb) {
    let list = [];

    // push default endpoints on top of the list
    list.push({"endpoint": 'api.bitex.gg', "isIPv6": true, "backup": false, "main": true});
    list.push({"endpoint": 'api.mntank.com', "isIPv6": true, "backup": false, "main": true});
    list.push({"endpoint": 'api.bithostcoin.com', "isIPv6": true, "backup": false, "main": true});
    list.push({"endpoint": 'api.bithostcoin.io', "isIPv6": true, "backup": false, "main": true});
    list.push({"endpoint": 'api.bithostcoin.net', "isIPv6": true, "backup": false, "main": true});

    GET('/api/v1/public/addnodes/bih', function (res) {
        for (let i in res) {
            const addr = res[i].addr;
            const is6 = addr.indexOf('[') != -1;
            let ip = addr;
            if (is6) ip = ip.split(']')[0] + ']';
            else ip = ip.split(':')[0];
            const endpoint = 'wss://' + ip + ':' + WSS_PORT;
            list.push({"endpoint": endpoint, "isIPv6": is6, "backup": true, "main": false});
            //console.log(is6, endpoint);
            cb(list);
        }
    });
}


function publicAccountCreate(USERNAME, EMAIL, PASSWORD, cb) {
    // create API and API_KEY pair.
    if (API || API_KEY) {
        red('STOP: API ' + API + ' FOUND ON ' + CONFIG_FILE_NAME + ', IGNONING ACCOUNT CREATION.');
        return;
    }

    /* // you can ignore locale/lang detection with:
    publicAccountCreate_with_country_id(USERNAME, EMAIL, PASSWORD, 'en', '0, 'none', cb);
    * */

    publicCountries(function (contries) {
        let COUNTRY_ID = 0; // default to us
        let COUNTRY = 'NONE';
        const C = locale().toUpperCase();
        //yellow('- CREATE ACCOUNT: LIST OF LOCALES [' + C + ']:');
        for (let i in contries) {
            const r = contries[i];
            if (C != r.iso)
                continue;
            COUNTRY_ID = r.id
            COUNTRY = r.label;
            yellow('-- LOCALE: id=' + r.id + ' name=' + r.label);
            break;
        }

        const LANG = language();
        publicAccountCreate_with_country_id(USERNAME, EMAIL, PASSWORD, LANG, COUNTRY_ID, COUNTRY, cb);
    });
}

function publicAccountCreate_with_country_id(USERNAME, EMAIL, PASSWORD, LANG, COUNTRY_ID, COUNTRY, cb) {

    // WARNING: do not try to create too much account.
    // You get blocked by DDoS protection.
    // TTL: 1 account per minute.

    // to raise this limit, ask: talk-with@bitex.gg

    let ACCOUNT = {};
    ACCOUNT.lang = LANG;
    ACCOUNT.username = USERNAME;
    ACCOUNT.email = EMAIL;
    ACCOUNT.country_id = COUNTRY_ID; // bitex.publicCountries
    ACCOUNT.contry = locale();
    ACCOUNT.telegram = USERNAME;
    ACCOUNT.discord = USERNAME;
    ACCOUNT.password = sha256(uuid());
    ACCOUNT.__AUTH_API = md5(EMAIL); // gen from email
    ACCOUNT.API_KEY = sha256(uuid());
    ACCOUNT.reflink = '1';
    ACCOUNT.tz = timezone();
    ACCOUNT.ts = timestamp();
    ACCOUNT.version = VERSION;
    console.log(ACCOUNT);

    GET('/api/v1/public/signup', function (res) {
        console.log(res);
        const err = res.err;
        const details = res.details;
        const auth_status = res.auth_status;
        if (err) { //
            red('ERROR ON ACCOUNT CREATION: ');
            red(details);
            return;
        }
        green('ACCOUNT CREATED, SAVING ON CONFIG ' + CONFIG_FILE_NAME);
        API = ACCOUNT.__AUTH_API;//
        API_KEY = ACCOUNT.API_KEY;
        // sotre it for future use
        config_save('API', API);
        config_save('API_KEY', API_KEY);
        if (cb) cb(res);
    }, ACCOUNT);
}

function publicAccountUpdate(USERNAME, EMAIL, PASSWORD, cb) {
    const EMAIL_HAHS = '';
    let args = [];
    args.push(ACCOUNT.uid);
    console.log(ACCOUNT);
    console.log(USERNAME);
    console.log(EMAIL);
    console.log(EMAIL_HAHS);

    call('auth.api_account_profile_update', args, function (res) {
        const r = res[0];
        const ok = r.ok;
        const str = r.str;
        const auth_status = res.auth_status;
        if (!ok) { //
            red('ERROR ON ACCOUNT UPDATE: ');
            red(str);
            return;
        }
        green(str);
        if (cb) cb(r);
    });
}

function authData() {
    if (!AUTH) {
        red('authData error: no auth data.');
        return;
    }
    return AUTH;
}

let BALANCE_CACHE_BY_SYMBOL = {};
let BALANCE_BY_SYMBOL = {};
let BALANCE_BY_ID = {};
let BALANCE_SYMBOL_BY_ID = {};
let DEPOSIT_ADDRESS_GENERATED = 0;// on first call, generate deposit addresses
function accountBalances(cb, debug) {
    if (!cb) {
        return red('accountBalances err: no callback.');
    }
    if (!DEPOSIT_ADDRESS_GENERATED) {
        call('ex.api_account_critical_ex_addr', [1], function (res) {
            DEPOSIT_ADDRESS_GENERATED = 1;
            on_balances(res);
            cb(res);
        }, debug);
    } else {
        call('ex.api_account_ex_addr', [0], function (res) {
            on_balances(res);
            cb(res);
        }, debug);
    }
}

function on_balances(res) {
    for (let i in res) {
        const r = res[i];
        const Symbol = r.name;
        const Id = r.id;
        const Balance = r.BALANCE;
        BALANCE_SYMBOL_BY_ID[Id] = Symbol;
        BALANCE_BY_SYMBOL[Symbol] = Balance;
        BALANCE_CACHE_BY_SYMBOL[Symbol] = r;
        BALANCE_BY_ID[Id] = Balance;
    }
}

function on_balance_changed(BalanceId, Balance) {
    const Symbol = BALANCE_SYMBOL_BY_ID[BalanceId];
    BALANCE_BY_SYMBOL[Symbol] = Balance;
    BALANCE_BY_ID[BalanceId] = Balance;
    //yellow('On Balance Change: ' + BalanceId + ') ' + Symbol + '=' + Balance);
}

function SymbolOf(BalanceId) {
    return BALANCE_SYMBOL_BY_ID[BalanceId];
}

function BalanceIdOfSymbol(Symbol) {
    return BALANCE_CACHE_BY_SYMBOL[Symbol].id;
}

function Faucet(Amount, Symbol, cb, debug) {
    // BIHT IEO test service
    const Symbol = 'BTCT'; // valid BIHT | BTCT
    if (!cb) {
        return red('faucetBalance err: no callback.');
    }
    if (!Amount || Amount <= 0) {
        return red('faucetBalance err: invalid Amount.');
    }
    if (BALANCE_BY_SYMBOL[Symbol] === undefined) {
        return red('faucetBalance err: invalid symbol ' + Symbol);
    }

    if (Symbol != 'BIHT' && Symbol != 'BTCT') {
        // yes I know... and it block on backend too.
        return red('faucetBalance err: invalid symbol ' + Symbol);
    }

    call('ex.api_account_critical_faucet', [Symbol, Amount], function (res) {
        const err = res[0].err;
        const str = res[0].str;
        const BalanceId = res[0]._balance_id;
        //console.log(res);
        if (err > 0) {
            red('Faucet ' + Symbol + '=' + Amount + ' ERROR: ' + str);
        } else {
            if (debug) green('Faucet OK: ' + Symbol + '=' + Amount + ': ' + str);
            // ok, now, update balances
            accountBalances(function (balances) {
                const NewBalance = BALANCE_BY_SYMBOL[Symbol];
                cb(NewBalance, Symbol, BalanceId, balances);
            }, debug);
        }
    }, debug);
}

function sendMoneyTo(DestinationAccountId, Symbol, Amount, TransactionId, cb, debug) {
    if (!Symbol) return red('STOP-INVALID-SYMBOL');
    const r = BALANCE_CACHE_BY_SYMBOL[Symbol];
    if (!r) return red('STOP-INVALID-BALANCE-DATA');
    const Balance = r.BALANCE;
    if (Balance <= 0) return red('STOP-NO-BALANCE-AMOUNT');
    if (Balance < Amount) return red('STOP-INSUFICIENT-BALANCE');
    const FromBalance_id = r.id;
    //console.log(Amount, Symbol);
    let args = [];
    args.push(FromBalance_id);
    args.push(DestinationAccountId);
    args.push(Amount);
    args.push(TransactionId);

    call('ex.api_account_critical_ex_transfer', args, function (res) {
        const err = res[0].status;
        const str = res[0].str;
        if (err) {
            red(str);
            return; // we don't callback if get an error, it's up to your
            // to callback in case of error.
        }
        if (debug) green('Transfer of ' + Symbol + '=' + Amount + ': "' + str + '"');
        if (cb) cb(res);
    }, debug);
}

function balanceHistoryDeposits(BalanceId, cb, debug) {
    if (!BalanceId) return red('balanceHistoryDeposits: No BalanceId.');
    if (!cb) return red('balanceHistoryDeposits: No cb.');
    let args = [];
    args.push(BalanceId);
    call('ex.api_account_ex_deposits', args, cb, debug);
}

function balanceHistoryWithdraw(BalanceId, cb, debug) {
    if (!BalanceId) return red('balanceHistoryWithdraw: No BalanceId.');
    if (!cb) return red('balanceHistoryWithdraw: No cb.');
    let args = [];
    args.push(BalanceId);
    call('ex.api_account_ex_withdrawns', args, cb, debug);
}

function myLocalGateways(country, currency, cb, debug) {
    if (!cb) return red('myLocalGateways: No cb.');
    let args = [1, country, currency];
    call('payment.api_account_gw_list', args, cb, debug);
}

function nl2br(str){
    if( ! str ) return '';
    //console.log('nl2br', typeof str,str);
    if( typeof str === 'string')
        return str.replace('\n', '<br>\n');
    if( typeof str === 'object')
        return str.toString('utf8').replace('\n', '<br>\n');

    return str;
}