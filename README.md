![Open Savings Initiative](./osi-logo.png)

[https://opensavings.network](https://opensavings.network)

# Introduction

Open Savings Initiative lets you set aside cryptocurrency that can only be spent after a certain date. It's like a certificate of deposit that you can add more money to anytime, but doesn't require a bank.

You can also use it to gift money that can't be spent until a certain date, like writing a cheque for a future date, except it can't bounce or be cancelled.

The app accomplishes this by utilizing features of the blockchain protocol, rather than depending on some custom infrastructure.

The Open Savings Initiative app is built with Typescript, Anuglar, and Electron, and can be packaged for deployment to the web, or as a native Windows/Mac/Linux desktop app.

## Acknowledgements

This app was developed by [Ransom Christofferson](http://ransomchristofferson.com/) and the [Prestige IT](https://prestigeit.io/) team with guidance from [Yeoman's Capital](https://www.yeomans.capital/), and was funded by a generous donation from [Ricardo Jimenezh](https://www.linkedin.com/in/ricardojimenezh/).

Development was bootstrapped from [maximegris/angular-electron](https://github.com/maximegris/angular-electron).

The Open Savings Initiative logo was built from [two](https://www.iconfinder.com/icons/1175307/piggy_piggycoin_icon) [icons](https://www.iconfinder.com/icons/1175251/bitcoin_btc_cryptocurrency_icon) created by AllienWorks, licenced under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).

# How it works

TL;DR---The app uses the `OP_CHECKLOCKTIMEVERIFY` opcode to build a pay-to-script-hash (P2SH) address. The coins sent to the P2SH address are only spendable by a newly generated private key, which is given to the user for safe keeping, digitally or printed. This effectively creates a time-locked paper wallet.

___

The script used to build the P2SH (i.e. the "redeem script") is:

```
<timestamp> OP_CHECKLOCKTIMEVERIFY OP_DROP OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
```

This is a standard pay-to-pubkey-hash (P2PKH) script, but with a time-locking element added to it. The script to spend coins at this P2SH address (i.e. the "scriptSig") is:

```
<sig> <pubKey> <redeemScript>
```

Just as with a common P2PKH transaction, only the owner of a specific address may spend the coins sent to the P2SH address. We'll call this person the "recipient".


`<timestamp>` is a date and time specified by the user---the coins are unspendable until this time.

`<pubKeyHash>` is the recipient's address.

`<sig>` is the signature of the transaction, signed with the recipient's private key.

`<pubKey>` is the recipient's public key.

`<redeemScript>` is the serialized redeem script.

The recipient's private key must be used in order to spend the time-locked coins, and typical wallets don't support spending from nonstandard P2SH address like this one. To get around this problem (and **not** require the user to export his wallet's private keys in order to use them in this app), the app generates a fresh private key to use as the recipient. The user must keep this private key safe.

The user is given this new private key, along with the redeem script. This is all that's needed to spend the coins.


# Developing

Clone this repository locally and install dependencies with npm:

``` bash
git clone https://github.com/coinbackup/opensavings.git
cd opensavings
npm install
```

## Dev & build commands

|Command|Description|
|--|--|
|`npm start`| Run the app in electron |
|`npm run ng:serve:web`| Run the app in the browser with hot reload (native libraries don't work in this mode) |
|`npm run build:prod:web`| Build the app with Angular aot, packaged for deployment as a website. The files will be in `dist`. |
|`npm run electron:linux`| Builds the app as a native linux application |
|`npm run electron:windows`| On Windows, builds the app as a native Windows application |
|`npm run electron:mac`| On Mac OS, builds the app as a native Mac application |

See [maximegris/angular-electron](https://github.com/maximegris/angular-electron) for more dev/build commands.

## Project layout

### Creating the P2SH address and building transactions

The app uses `bitcore-lib` and `bitcore-lib-cash` to handle most operations. The custom P2SH address and scriptSig are built in `TimeLockService (services/time-lock/time-lock.service.ts)`.

Transactions are built in `components/redeem/redeem.component.ts`.

### Interacting with the blockchain

The app makes HTTP calls to certain bitcoin nodes which expose a public REST API to read data from the blockchain or broadcast transactions to it.

```
BlockchainService -> BlockchainType -> Explorer -> NetworkService
```

* To read from or broadcast to the blockchain, call methods on the `BlockchainService (services/blockchain/blockchain.service.ts)`. This service makes http requests to multiple APIs simultaneously, to achieve high availability.
* APIs and endpoint URLs for BTC, BCH, and their testnets are defined in `BlockchainType (models/blockchain-types.ts)`.
* API responses are handled and normalized in `Explorer` classes `(models/explorer-types.ts)`.
* Raw http requests are handled in `NetworkService (services/network/network.service.ts)`.

To add another API endpoint, define its behavior in `models/explorer-types.ts`, and add its URL in `models/blockchain-types.ts`.