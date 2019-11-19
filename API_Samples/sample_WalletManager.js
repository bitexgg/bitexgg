"use strict";
const {Table} = require('console-table-printer');
const os = require('os');
let DEV = process.env.DEV || os.hostname() == 'wendel';
const bitex = require('./bitex.gg');

// bootstrap, pass api and api-key
// - YOUR STORED API+API_KEY
bitex.init(__dirname + '/.bitex.private', DEV); // json with api and api_key
ENDPOINTS_SETUP(DEV); // - WHERE TO CONNECT? (most handled automaticly)

const API = process.argv[2]; // if passed as arg or from .bitex.private.
const API_KEY = process.argv[3]; // if passed as arg or from .bitex.private.
bitex.connect(APPLICATION_ONLINE, API, API_KEY, DEV); // call back after connected.


// bellow, functions helpers...

/**
 * You are connected and ready to send|rcvd commands to platform.
 * @param AuthData: your login data, lots of info.
 * @param Balances: your balances with addresses and BalanceIds
 * @constructor
 */
function APPLICATION_ONLINE(AuthData, Balances) {
    bitex.magenta('-- SAMPLE APPLICATION ONLINE --');
    const username = AuthData.name;
    const email = AuthData.email;
    const AccountID = bitex.authData().client_id;
    //console.log(AuthData);
    bitex.green('Connected as: AccountID=' + AccountID + ' Username="' + username + '"' + " <" + email + ">");
    const debug = DEV;

    // -- get some test balance:

    // -- or --
    //Faucet(DEV);

    // -- check your balance:
    bitex.accountBalances(YourBalanceAddresses, debug);

    // -- be notified when you get some coins
    bitex.on('balance_change', OnCoinsReceived);

    /* if (AccountID == '98362563419323261') { // acc A
        // send some coins from account A to Account B
        SendTo('98362563419754721', 'BIHT', 1, debug);
    } */

    // see your deposits
    //BalanceHistoryDepositsBySymbol('BIHT', debug);

    // see your withdraw
    BalanceHistoryWithdrawBySymbol('BIHT', debug);

}

/**
 * See deposits of symbol
 * @param Symbol: the symbol name from Balances data
 * @param debug
 * @constructor
 */
function BalanceHistoryDepositsBySymbol(Symbol, debug) {
    const BalanceId = bitex.BalanceIdOfSymbol(Symbol);
    bitex.balanceHistoryDeposits(BalanceId, function (data) {
        bitex.magenta('=== Your Deposits ===');
        const tableOptions = {style: 'fatBorder'}
        const p = new Table(tableOptions);
        let is_empty = true;
        for (let i in data) {
            const r = data[i];
            let line = {};
            line.ID = r.ID;
            line.AMOUNT = r.AMOUNT;
            line.TS_PAID = r.TS_PAID;
            line.SENT_TS = r.SENT_TS;
            line.STATUS = r.STATUS;
            line.TTL = r.TTL;
            line.TX = r.TX;
            const o = {color: color};
            p.addRow(line, o);
        }
        p.printTable();
    }, debug);
}

/**
 * See withdraw of symbol
 * @param Symbol: the symbol name from Balances data
 * @param debug
 * @constructor
 */
function BalanceHistoryWithdrawBySymbol(Symbol, debug) {
    const BalanceId = bitex.BalanceIdOfSymbol(Symbol);
    bitex.balanceHistoryWithdraw(BalanceId, function (data) {
        bitex.magenta('=== Your Withdrawns ===');
        const tableOptions = {style: 'fatBorder'}
        const p = new Table(tableOptions);
        let is_empty = true;
        for (let i in data) {
            const r = data[i];
            let line = {};
            line.ID = r.ID;
            line.AMOUNT = r.AMOUNT;
            line.TS_PAID = r.TS_PAID;
            line.SENT_TS = r.SENT_TS;
            line.STATUS = r.STATUS;
            line.TTL = r.TTL;
            line.TX = r.TX;
            const o = {color: color};
            p.addRow(line, o);
        }
        p.printTable();
    }, debug);
}

/**
 * Get some coins for testing.
 *  BTCT: the bitcoin IEO for testing.
 *  BIHT: the bithost IEO for testing.
 * @param debug
 * @constructor
 */
function Faucet(debug) {
    bitex.Faucet(1, 'BTCT', onFaucetAirDrop, debug);
    bitex.Faucet(1, 'BIHT', onFaucetAirDrop, debug);
}

/**
 * Callback with all balance accounts when you call bitex.accountBalances(YourBalanceAddresses, debug);
 * @param Balances: arraym of object with wallet accounts.
 * @constructor
 */
function YourBalanceAddresses(Balances) {

    const ONLY_DISPLAY_POSITIVE_BALANCE = true;

    let columns = [
        {name: 'Type', alignment: 'left'},
        {name: 'Symbol', alignment: 'left'},
        {name: 'AddressId', alignment: 'right'},
        {name: 'Address', alignment: 'right'},
        {name: 'Balance', alignment: 'right'}
    ];

    const tableOptions = {style: 'fatBorder', columns}
    const p = new Table(tableOptions);
    let is_empty = true;
    for (let i in Balances) {
        const r = Balances[i];
        let color = 'cyan';
        if (r.BALANCE > 0) {
            color = 'green';
        }
        let line = {};
        line.Type = r.type_name;
        line.Symbol = r.name;
        line.AddressId = r.id;
        line.Address = r.addr;
        line.Balance = r.BALANCE;
        const o = {color: color};
        if (r.BALANCE <= 0 && ONLY_DISPLAY_POSITIVE_BALANCE)
            continue; // only display balances
        if (is_empty) is_empty = false;
        p.addRow(line, o);
    }
    if (!is_empty) {
        p.printTable();
    } else {
        bitex.magenta('WARNING: No positive balances and ONLY_DISPLAY_POSITIVE_BALANCE=1');
        bitex.yellow(' - Use Faucet() to get some coins for testing.');
        const AccountID = bitex.authData().client_id;
        bitex.yellow(' - Ask someone to send some coins to AccountId: ' + AccountID);
    }

}

/**
 * callback with faucet result call, use to know how much coins received.
 * @param NewBalance: new amount received
 * @param Symbol: amount received at this symbol
 * @param BalanceId: amount received at this BalanceId
 * @param Balances: all updated balances.
 */
function onFaucetAirDrop(NewBalance, Symbol, BalanceId, Balances) {
    console.log(BalanceId + ') ', Symbol, '=', NewBalance);
}


/**
 * Secure WebSocket endpoint to connect to BitEx network.
 * Use bitex.publicEndpoints to fetch an list of endpoints and store it.
 * @param debug
 * @constructor
 */
function ENDPOINTS_SETUP(debug) {
    if (DEV) {
        // this is developer env
        if (debug) bitex.red('**LOCALHOST DEV!** DISABLED IT! WILL NOT WORK.');
        bitex.publicEndpoint('localhost');
    } else {
        bitex.publicEndpoint('api.bitex.gg');
        //bitex.publicEndpoints(console.log);
    }

}

/**
 * Send coins to other user by symbol and AccountId.
 *  Ask user the AccountId.
 * @param DestinationAccountId: other user AccountId number.
 * @param Symbol: from Balances symbol
 * @param Amount: any positive amount on your balance.
 * @param debug
 * @constructor
 */
function SendTo(DestinationAccountId, Symbol, Amount, debug) {

    // TransactionId: can be any code to control your funds.
    // internally we use it to prevent double deposits.
    // Same transactions transfers are ignored.
    const TransactionId = bitex.sha256(bitex.uuid());

    bitex.sendMoneyTo(DestinationAccountId, Symbol, Amount, TransactionId,
        function (res) {
            bitex.accountBalances(YourBalanceAddresses, DEV);
        }, debug);
}

/**
 * This is an event callback for any balance change of connected account
 * @param data: if about symbol and new balance amount.
 * @constructor
 */
function OnCoinsReceived(data) {
    const BalanceId = data.balance_id;
    const Amount = data.balance_amount;
    const Symbol = bitex.SymbolOf(BalanceId);
    bitex.green('OnBalanceChange: BalanceId=' + BalanceId + ' ' + Symbol + '=' + Amount);
}