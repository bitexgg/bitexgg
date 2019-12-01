"use strict";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const request = require('request');
let url;
let io; // to use sha256
module.exports = {
    init: init,
    newAccount: newAccount
};
function init( arg_io, arg_url ){
    io = arg_io;
    url = arg_url;
    console.log('test server url: '+url);
}
function newAccount(){
    console.log('newAccount');
    let accountData = {};
        accountData.USERNAME = 'test'+io.timestamp();
        accountData.EMAIL = accountData.USERNAME+'@bitex.gg';
        accountData.PASSWORD = io.uuid();

    post('/api/v1/newAccount', accountData, onNewAccountCreated);
}

function onNewAccountCreated(res){
    console.log('onNewAccountCreated', res);
}

function post(uri, arg_body, callback) {
    let headers = {'content-type': 'application/json'};
    let data = {};
        data.headers = headers;
        data.url = url+uri;
        data.body = JSON.stringify(arg_body);
    //console.log(data.body);
    request.post(data, function (err, res, body) {
        if (err) {
            console.error(err);
            return;
        }
        const r = JSON.parse(res.body);
        if( ! r.success ){
            console.log('test.js> POST: '+uri);
            console.log('test.js> ERROR '+r.code+': '+r.message);
            return; // we don't exec callback on error, do we need?
        }
        //console.log('data.body', data.body);
        //console.log('res.body', res.body);
        if (callback) callback(res);
    });
}