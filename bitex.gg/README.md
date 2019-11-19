# BitEx.gg application example

This is an full API implementation of https://bitex.gg 
exchange that you can use to build your 
bot|exchange|price-discovery applications.

# Samples

Download samples from https://github.com/bitexgg/bitexgg.git:

```
git clone https://github.com/bitexgg/bitexgg.git
cd exchange/node_samples

# to create and mange your account:
nodemon sample_AccountManager.js

# to send and receive coins:
nodemon sample_WalletManager.js
```

Then, just look at `sample_*` for operations that are of you interest.



# About Security

## Username/Password Security
- We don't use username and password for exchange operations.
- Username and password are only used to rigester API and API KEY.
- You must protect saved API KEY with AES encryptation with an PIN CODE on user application.

## API & API KEY
- The exchange use API and API KEY to sign with HMAC-SHA256 each request.
- Then, each request is checked on backend, if signature and time match the operation is processed.

## Data Transport Security
- We use Secure Websocket with HIGH-SECURE TLS configuration, we added prevention against MiMT and POODLE attacks.
- To prevent cert forgery, we check the digest of server certificate.

## Transaction Security

Each operation that involve funds exchange, asset exchange are isolated on
critical queue transaction with mutex+semaphoeres, to prevent double spend
attacks or "exchange balance bleeding".

## Wallets/Funds protections

Wallets does not run on cloud, it's run on isolated servers outside 
cloud services and inside docker isolatios to prevent any type of API calls.

Wallets can connect only with relay-servers.    

## How backend exchange works?

- The exchange use a network of relays that works as endpoint for users.
- When the app exchange is integrated inside wallet, it's use masternodes as possible endpoints.
- Whne the exchange is build standalone it try to fetch a list of endpoints from a list of possible domains.

## Endpoint redundancy

The applications push Every hour a list of possible and points and store 
it on user computer.
If Primary endpoint fails the application start search for other 
possible endpoint.

