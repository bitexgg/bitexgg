"use strict";

process.on('uncaughtException', function (err) {
    console.error('uncaughtException', err);
    process.exit(1);
});


process.setMaxListeners(0);
require('events').EventEmitter.defaultMaxListeners = 0;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const dotenv = require('dotenv');
const test = require('./test');
const result = dotenv.config({path: '/home/admin/rc.conf'});

if (result.error) {
    throw result.error;
}
//const db_config = require('./cfg.js');
//const config = require('./config.js');

const main = require('./lib_main.js');
const io = main.get_io();
//const discord = require('./discord.js');
let https_server;
const express = require('express');
// >>> http
const express_server = express();

const https = require('https');
const helmet = require('helmet');
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');
const session = require('express-session');
let session_server, sessionStore;
const ipCountry = require('ip-country');
const compression = require('compression');
const FileStore = require('session-file-store')(session);

//const app_socket_io = require('./libsocket.io.js');
//let socket;
let cfg = {}; // global config

const port = process.env.HTTPS_PORT || 9439;
const url = require('url');
// <<< http

let site_config = {};
let sid_by_host = {};
let site_cache_status = {};
let site_cache_refresh = false;

function fullUrl(req) {
    return url.format({
        protocol: req.protocol,
        host: req.get('host'),
        pathname: req.originalUrl
    });
}

function c_country() {
    express_server.use((req, res, next) => {
        res.locals.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        next()
    });
    express_server.use(ipCountry.setup({
        mmdb: './mmdb/GeoLite2-Country.mmdb',
        fallbackCountry: 'US',
        exposeInfo: false
    }));
}

function https_init() {

    cfg.COOKIE_SECRET = io.cfg('SECRET');
    console.log('cfg.COOKIE_SECRET', cfg.COOKIE_SECRET);

    sessionStore = new FileStore({path: '/tmp', ttl: 999999});

    express_server.use(bodyParser.urlencoded({extended: true,
        verify:function(req,res,buf){
            req.rawBody = buf;
        }
    }));

    express_server.use(helmet());//
    express_server.set('trust proxy', 1); // trust first proxy
    express_server.set('json spaces', 40);
    express_server.set('view engine', 'ejs');

    express_server.use(express.static('/backend/public_html'));
    express_server.use(cookieParser(cfg.COOKIE_SECRET, {
        secure: true, path: '/',
        maxAge: 99999999, expires: new Date(2050)
    }));

    session_server = session({
        secret: cfg.COOKIE_SECRET,
        store: sessionStore,
        proxy: true,
        resave: true,
        saveUninitialized: true
    });

    express_server.use(session_server);
    express_server.use(function (req, res, next) {
        if (!req.session) {
            return next(new Error('WARNING-SESSION-ERROR'));
        }
        next();
    });

    express_server.use(compression());

    express_server.use(function (req, res, next) {
        res.removeHeader('X-Powered-By');
        const host = req.headers.host;
        const host_x = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const agent = req.headers['user-agent'];
        const lang = req.headers["accept-language"];
        console.log(lang, '/', host, '/', host_x, '/', agent);
        if (lang) {
            /*
            if( lang.split(',')[0] == 'pt-BR' ) {
                return res.status(404).send('Not found');
            }
            */
        }
        next();
    });

    /*
    express_server.use(function (req, res, next) {
        res.header('Content-Type', 'application/json');
        next();
    });
    */

    express_server.use(function (req, res, next) {
        if (req.session && req.session.impersonate) {
            req.user = req.session.impersonate;
        }
        next();
    });

    c_country();

    const options = {};

    options.cert = io.cat('/backend/tls/server-cert.pem');
    options.key = io.cat('/backend/tls/server-key.pem');
    options.ca = io.cat('/backend/tls/ca.pem');

    if (!server_is_online) {
        https_server = https.createServer(options, express_server);
        https_server.on('clientError', (err, socket) => {
            console.log('clientError', err);
        });
        https_server.on('error', (err) => {
            console.log('error', err);
        });
        https_server.listen(port, site_setup_init);
    } else {
        site_setup_init();
    }

}

let server_is_online = false;

function site_setup_init(cfg) {
    if (!https_server) {
        io.red('!server');
        return;
    }
    server_is_online = true;
    const server_url = 'https://localhost:' + https_server.address().port;
    io.green(server_url);

    //express_server.get('/rpc/v1/:app', main.api_call);
    //express_server.post('/rpc/v1/:app', main.api_call);

    main.routers(express_server);

    //test_exec(io, server_url);

    socket_io_setup();

    express_server.use(function (req, res) {
        const url = fullUrl(req);
        const s = 'NOT FOUND: ' + url;
        io.red(s);
        res.status(404).send(s);
    });

}

function socket_io_setup() {
    return console.log('DISABLED: socket_io_setup');
    io.magenta('socket.io');
    socket = require('socket.io')(https_server);
    socket.use(function (socket, next) {
        session_server(socket.request, {}, next);
    });

    lib_socket_io.init(io, express_server, cfg);
    socket.on('connection', lib_socket_io.connection);
}

function test_exec(io, server_url) {
    test.init(io, server_url);
    test.newAccount();
}

main.init(https_init);