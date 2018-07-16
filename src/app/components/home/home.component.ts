import { Component, OnInit } from '@angular/core';

/**
 * This tool creates a P2SH address. Sending coins to the address will time-lock the coins.
 * Only the owner of a specific address may spend the coins, after the lock time passes.
 * 
 * There are two basic ways to accomplish this.
 * 
 * 1: The CLTV-P2PKH script
 * redeemScript: <timestamp> OP_CHECKLOCKTIMEVERIFY OP_DROP OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
 * scriptSig: <sig> <pubKey> <redeemScript>
 * This effectively builds a standard P2PKH transaction, except it's time-locked.
 * 
 * 2: The CLTV-P2PK script
 * redeemScript: <timestamp> OP_CHECKLOCKTIMEVERIFY OP_DROP <pubKey> OP_CHECKSIG
 * scriptSig: <sig> <redeemScript>
 * This effectively builds a standard P2PK transaction, except it's time-locked.
 */

//@@
import { TimeLockPubKey, TimeLockPubKeyHash, TimeLockScriptInterface } from '../../models/time-lock-script';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import * as Bitcore from 'bitcore-lib';
import * as QRCode from 'qrcode';
import { resolve } from 'dns';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

    addressQrData: string;
    
    redeemer: any = {};
    p2sh: any = {};
    
    readonly scriptType: TimeLockScriptInterface = new TimeLockPubKeyHash();

    constructor( private blockchainService: BlockchainService ) {

        blockchainService.setBlockchain( this.blockchainService.blockchainTypes.tBTC );

        // Create the wallet which will be able to redeem the locked coins
        this.redeemer.privateKey = new Bitcore.PrivateKey( 'cPuXSjN4RACUvL3DXjdmw343bzwvSBnRQWfbrMCe3776hxW4mDvp' ); // m/44'/1'/0`/0/3
        this.redeemer.publicKey = this.redeemer.privateKey.toPublicKey();
        this.redeemer.address = this.redeemer.publicKey.toAddress();
        this.redeemer.base58Address = this.redeemer.address.toString();

        // Create the P2SH script and address
        let expireTimeSeconds = 1531684846;
        let script = this.scriptType.buildRedeemScript( expireTimeSeconds, this.redeemer.address );
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
        this.blockchainService.getUTXOs( this.p2sh.base58Address )
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
        // The parameters in the below method call are hardcoded now, but will ultimately just be scanned/entered by the user
        this.redeemToAddress( this.p2sh.redeemScript.toString(), this.redeemer.privateKey.toWIF(), 'mfjHUg1JM7vrTaEE8r54Xn5DSEgkE87URv' );
    }

    // @@ instead of taking a redeemScript, should it just take a timestamp and pubkeyhash? No, because I want the user to be able to see the script.
    // @@ Also I should put the scriptSig conditions on the cheque
    // @@ Maybe just time and hash if the QR is super large.
    redeemToAddress( fromRedeemScript: string, redeemerPrivateKeyWIF: string, toAddress: string ) {

        console.log( 'Checking for UTXOs' );

        let redeemScript = Bitcore.Script( fromRedeemScript );
        let p2shAddress = Bitcore.Address.payingTo( redeemScript ).toString();
        let privateKey = new Bitcore.PrivateKey( redeemerPrivateKeyWIF );

        this.blockchainService.getUTXOs( p2shAddress )
        .then( (utxos:any[]) => this.buildRedeemTx(redeemScript, privateKey, toAddress, utxos) )
        .then( tx => this.blockchainService.broadcastTx(tx) )
        .then( newTxId => console.log(newTxId) )
        .catch( err => {
            console.error( err );
        });
    }


    //QRCode.toDataURL( address.toString(), {width: 800} )

    private buildRedeemTx( redeemScript: Bitcore.Script, redeemerPrivateKey: Bitcore.PrivateKey, toAddress: string, utxos: any[] ): Bitcore.Transaction {
        return new Promise( (resolve, reject) => {
            if ( utxos.length === 0 ) {
                return reject( 'Empty! No UTXOs!' );
            }

            this.blockchainService.getFeeRates().then( rates => {
        
                // Extract the time lock expiry from the script
                var timeLockBuf = redeemScript.chunks[0].buf;
                var lockTimeSeconds = Bitcore.crypto.BN.fromBuffer( timeLockBuf, {endian: 'little'} ).toNumber();
                
                // Find the total amount avaialble to spend
                let totalSatoshis = utxos.reduce( (total, utxo) => total + utxo.satoshis, 0 );
        
                // Calculate a fee in Satoshis
                let txSizeBytes = this.scriptType.getEstimatedTxSize( utxos.length );
                let feePerByte = rates.high; // @@ use a high fee for now
                let fee = Math.round( feePerByte * txSizeBytes );
        
                // Build the transaction to redeem the coins
                let tx = new Bitcore.Transaction()
                .from( utxos )
                .to( toAddress, totalSatoshis - fee )
                // Must include nLockTime in order to spend CLTV-locked coins
                // Add one second to the CLTV lockTime to ensure it passes the test
                .lockUntilDate( new Date((lockTimeSeconds+1) * 1000) );
                
                tx.inputs.forEach( (input, i) => {
                    // Set sequenceNumber on inputs now, since it can't be done during the .from() function.
                    // If sequenceNumber is the default value, nLockTime will be ignored and the CLTV opcode will cause the tx to fail
                    input.sequenceNumber = 0;
                    // Sign the input and replace the scriptSig on the input with a new one that will be able to spend the coins.
                    input.setScript( this.scriptType.buildScriptSig(tx, i, redeemerPrivateKey, redeemScript) );
                });

                resolve( tx );
            });
        });
    }


    ngOnInit() {
    }

}

