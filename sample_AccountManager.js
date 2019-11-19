"use strict";
const os = require('os');
let DEV = process.env.DEV || os.hostname()=='wendel' ;
const bitex = require( './bitex.gg' );




// bootstrap, pass api and api-key
// - YOUR STORED API+API_KEY
bitex.init( __dirname+'/.bitex.private', DEV ); // json with api and api_key
ENDPOINTS_SETUP(DEV); // - WHERE TO CONNECT (most handled automaticly)


// ================================================
// !!!*** ATTENTION!!! UNCOMENT THIS OPTION  ***!!!
// ................ to create new account..........
// ************************************************

//const OPERATION = 'CREATE_NEW_ACCOUNT';

// --- or ---


// then... first account create (.bitex.private file)
// uncoment this to keep testing...
const OPERATION = 'CONNECT_EXISTING_ACCOUNT';
//const OPERATION = 'UPDATE_ACCOUNT';


if( OPERATION == 'CREATE_NEW_ACCOUNT' ) {
    // - CREATE YOUR FIST ACCOUNT
    sample_account_create(DEV);
}else if( OPERATION == 'UPDATE_ACCOUNT' ) {
    sample_account_update(DEV);
}else if( OPERATION == 'CONNECT_EXISTING_ACCOUNT' ) {
    // - IF YOU HAVE API+API_KEY ON FILE index.js.txt:
    //   OR JUST PASS API AND API_KEY AS ARGUMENTS, LIKE:
    // nodemon index.js API-32-CHAR API_KEY-64-CHAR
    bitex.connect(APPLICATION_ONLINE, false, false, DEV); // call back after connected.
}else{
    bitex.red('INVALID OPERATION='+OPERATION);
}


// bellow, functions helpers...






/**
 * You are connected and ready to send|rcvd commands to platform.
 * @param AuthData: your login data, lots of info.
 * @param Balances: your balances with addresses and BalanceIds
 * @constructor
 */
function APPLICATION_ONLINE(auth_data) {
    bitex.magenta('-- SAMPLE APPLICATION ONLINE --');
    const username = auth_data.name;
    const email = auth_data.email;
    //console.log(auth_data);
    bitex.green('ONLINE: AS "' + username + '"' + " <" + email + ">");
    const debug = true;
    //sample_masternodes(debug);
    sample_account_extras(debug);
}

// SAMPLES SAMPLES SAMPLES SAMPLES
function sample_masternodes(debug) {
    bitex.api('mn.public_mn_stats', ['bih'], function (res) {
        console.log('SAMPLE: mn.public_mn_stats');
        console.log(res);
    }, debug);
}

// to setup endpoint connection
function ENDPOINTS_SETUP( debug ){
    if( DEV ) {
        // this is developer env
        if( debug ) bitex.red('**LOCALHOST DEV!** DISABLED IT! WILL NOT WORK.');
        bitex.publicEndpoint('localhost');
    }

    // -- or --

    // list of possible api endpoints,
    // if main endpoint is off, try to connect
    // in one of these.
    /*
    bitex.publicEndpoints( function(res){
        console.log(res);
    });
    */

}

function sample_account_create(debug) {

    // DO NOT CALL THIS API MULTIPLE TIMES, YOU GET BLOCKED.
    // ONE ACCOUNT CREATION BY MINUTE.
    if(debug) bitex.magenta('-- SAMPLE ACCOUNT CREATION --');

    const USERNAME = 'U'+bitex.timestamp();
    const EMAIL = USERNAME + '@example.com';
    const PASSWORD = bitex.sha256( bitex.uuid() );

    if(debug) bitex.yellow('- Creating the account: '+USERNAME+'\n  -- EMAIL '+EMAIL+'\n  -- PASSWORD '+PASSWORD);

    bitex.publicAccountCreate(USERNAME, EMAIL, PASSWORD, function(ACCOUNT_DATA){
        console.log('ACCOUNT_DATA');
        console.log(ACCOUNT_DATA);
    });
}

function sample_account_update() {

    bitex.magenta('-- SAMPLE ACCOUNT UPDATE --');

    // as account update by hmac key, you can chage email and password
    const USERNAME = 'U'+bitex.timestamp();
    const EMAIL = USERNAME + '@example.com';
    const PASSWORD = bitex.sha256( bitex.uuid() );

    bitex.publicAccountUpdate(USERNAME, EMAIL, PASSWORD, function(arg_res){
        console.log('UPDATE STATUS');
        console.log(arg_res);
    });
}

function sample_account_extras(debug){
    // get list of countries, then, get one id, ex:
    bitex.api('auth.public_user_profile_country', [], function (res) {
        bitex.magenta('List of Countries to fill signup combobox:' );
        console.log(res[0]);
        console.log(res[1]);
    }, debug);
    bitex.magenta('Your RefId (Referral Id): '+bitex.authData().reflink );
    //console.log('authData', bitex.authData() );
}


