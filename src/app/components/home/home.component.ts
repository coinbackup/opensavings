import { Component, OnInit } from '@angular/core';

// A P2SH-CLTV-P2PKH redeem script

//@@
import * as Bitcore from 'bitcore-lib';
import * as Explorers from 'bitcore-explorers';
import * as QRCode from 'qrcode';
import { resolve } from 'dns';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

    addressQrData: string;
    insight;
    foundTx: boolean = false;

    redeemer: any = {};
    p2sh: any = {};

    //readonly insightURL = 'https://test-insight.bitpay.com';
    readonly insightURL = 'https://testnet.blockexplorer.com';
    // https://www.localbitcoinschain.com

    constructor() {
        Bitcore.Networks.defaultNetwork = Bitcore.Networks.testnet;

        // Create the wallet which will be able to redeem the locked coins
        this.redeemer.privateKey = new Bitcore.PrivateKey( 'cPuXSjN4RACUvL3DXjdmw343bzwvSBnRQWfbrMCe3776hxW4mDvp' ); // m/44'/1'/0`/0/3
        this.redeemer.publicKey = this.redeemer.privateKey.toPublicKey();
        this.redeemer.address = this.redeemer.publicKey.toAddress();
        this.redeemer.pubKeyHash = this.redeemer.address.toObject().hash; // pubKeyHash as hex
        this.redeemer.base58Address = this.redeemer.address.toString(); // n1qJg8ZN2QfEi3q2foHxH5jUG3HQq65p82

        // Create the P2SH script and address
        // The P2SH redeem script should look like:
        // <Unix time> OP_CHECKLOCKTIMEVERIFY OP_DROP OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
        // Where <Unix time> is the time in seconds since 1970 at which the coins can be spent, and <pubKeyHash> is the hash of the address that can spend the coins
        let expireTimeSeconds = 1531684846;
        let script = Bitcore.Script()
        .add( Bitcore.crypto.BN.fromNumber(expireTimeSeconds).toScriptNumBuffer() )
        .add( 'OP_CHECKLOCKTIMEVERIFY')
        .add( 'OP_DROP' )
        .add( Bitcore.Script.buildPublicKeyHashOut(this.redeemer.address) );
        this.p2sh = {
            redeemScript: script,
            base58Address: Bitcore.Address.payingTo( script ).toString() // 2N3hxnxAeZ9PkiCbNC1aLrFvLyLtrNGEAgB
        };
        
        //console.log( script.toString() ); // save this info as the p2sh script, because it's understandable to all developers. Or maybe use hex?
    }


    showInfo() {
        console.log( 'Redeemer address: ' + this.redeemer.base58Address );
        console.log( 'P2SH address: ' + this.p2sh.base58Address );
        console.log( 'P2SH redeem script: ' + this.p2sh.redeemScript.toString() );
    }


    showBalance() {
        this.checkForTx( this.p2sh.base58Address )
        .then( (utxos: any[]) => {
            // Add the available satoshis from all UTXOs
            let totalSatoshis = utxos.reduce( (total, utxo) => total + utxo.satoshis, 0 );
            console.log( 'Balance: ' + Bitcore.Unit.fromSatoshis(totalSatoshis).toBTC() );
            console.log( utxos );
        })
        .catch( err => {
            console.error( err );
        });
    }


    redeem() {
        // This is the output script that was used to send money to the p2sh address: ("locking script")
        // console.log( this.p2sh.redeemScript.toScriptHashOut(), this.p2sh.redeemScript.toScriptHashOut().toString() );

        // Verify that the script will work
        // Bitcore.Script.Interpreter().verify( unlocking script + redeem script , locking script )


        // send the coins to mfjHUg1JM7vrTaEE8r54Xn5DSEgkE87URv
        console.log( 'Checking for UTXOs '  + this.p2sh.base58Address );
        this.checkForTx( this.p2sh.base58Address )
        .then( (utxos: any[]) => {

            if ( utxos.length === 0 ) {
                console.log( 'Empty! No UTXOs!' );
                return;
            }

            // Extract the time lock expiry from the script
            var timeLockBuf = this.p2sh.redeemScript.chunks[0].buf;
            var lockTimeSeconds = Bitcore.crypto.BN.fromBuffer( timeLockBuf, {endian: 'little'} ).toNumber();
            
            // Find the total amount avaialble to spend
            let totalSatoshis = utxos.reduce( (total, utxo) => total + utxo.satoshis, 0 );

            // Build the transaction to redeem the coins
            let tx = new Bitcore.Transaction()
            .from( utxos )
            .to( 'mfjHUg1JM7vrTaEE8r54Xn5DSEgkE87URv', totalSatoshis/* - 10000*/ )
            // Must include nLockTime in order to spend CLTV-locked coins
            // Add one second to the CLTV lockTime to ensure it passes the test
            .lockUntilDate( new Date((lockTimeSeconds+1) * 1000) );
            
            tx.inputs.forEach( (input, i) => {
                // Set sequenceNumber on inputs now, since it can't be done during the .from() function.
                // If sequenceNumber isn't set, nLockTime will be ignored and the CLTV opcode will cause the tx to fail
                input.sequenceNumber = 0;
                // Sign the input
                let signature = Bitcore.Transaction.sighash.sign( tx, this.redeemer.privateKey, Bitcore.crypto.Signature.SIGHASH_ALL, i, this.p2sh.redeemScript );
                // Replace the scriptSig on the input with a new one that will be able to spend the coins.
                // The scriptSig looks like: <sig> <pubKey> <redeemScript>
                let scriptSig = Bitcore.Script()
                .add( signature.toTxFormat() )
                .add( this.redeemer.publicKey.toBuffer() )
                .add( this.p2sh.redeemScript.toBuffer() )
                input.setScript( scriptSig );
            });
            
            // ._estimateFee()
            
            // The change address is not used because we're sending 100% of the inputs, but bitcore throws an error if we don't add one?
            //.change( 'mfjHUg1JM7vrTaEE8r54Xn5DSEgkE87URv' )
            //.feePerKb( 20 )
            // 1 input: 225 bytes
            // 2 : 405 bytes
            // 3 : 586 bytes
            // 45 bytes + 180 bytes/input

console.log( utxos.length, tx.serialize(true).length / 2 );
console.log( tx );
            return;

            // Can't verify this tx before broadcasting, because it's a nonstandard tx
            console.log('broadcasting', tx, tx.serialize(true) );

            // Pass true to serialize() to skip all verification tests. The tests will fail because this is a nonstandard tx.
            this.insight.broadcast( tx.serialize(true), (error, newTxId) => {
                console.log('response');
                if ( error ) {
                    console.error( 'Error in broadcast:' + error );
                } else {
                    console.log( 'txId:' + newTxId );
                }
            });
            
            
        })
        .catch( err => {
            console.error( err );
        });

        
    }
    
    
    checkForTx( address: string ) {
        if ( !this.insight ) {
            this.insight = new Explorers.Insight( this.insightURL );
        }

        return new Promise( (resolve, reject) => {
            this.insight.getUnspentUtxos( address, (err, utxos) => {
                if ( err ) reject( err );
                else resolve( utxos );
            });
        });
    }

    //QRCode.toDataURL( address.toString(), {width: 800} )



    ngOnInit() {
    }


}
