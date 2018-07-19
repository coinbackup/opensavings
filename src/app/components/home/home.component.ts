import { Component, OnInit, Inject, Input } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

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
import { BlockchainType, BlockchainTypes } from '../../models/blockchain-types';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { TimeLockTypes } from '../../models/time-lock-types';
import { TimeLockService } from '../../services/time-lock/time-lock.service';
import * as Bitcore from 'bitcore-lib';
import * as BitcoreCash from 'bitcore-lib-cash';
import * as QRCode from 'qrcode';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

    addressQrData: string;
    lockDate: string;
    lockTime: string;
    blockchains: BlockchainType[];

    @Input() set selectedBlockchain( chain ) {
        this._blockchainService.setBlockchainType( chain );
    }
    get selectedBlockchain() {
        return this._blockchainService.getBlockchainType();
    }

    private _offsetMilliseconds = new Date().getTimezoneOffset() * 60 * 1000;

    constructor( private _blockchainService: BlockchainService, private _timeLockService: TimeLockService, private _dialog: MatDialog ) {
        // Initialize with local date and time
        let nowOffset = new Date( new Date().getTime() - this._offsetMilliseconds ).toISOString();
        this.lockDate = nowOffset.substring( 0, 10 );
        this.lockTime = nowOffset.substring( 11, 16 );

        // Init blockchain select
        this.blockchains = BlockchainTypes.allTypes;
        this.selectedBlockchain = BlockchainTypes.BTC;

        // Set default blockchain and lockscript type
        this._timeLockService.setTimeLockType( TimeLockTypes.PKH );
    }

    public createTimeLockedAddress( lockDate, lockTime ) {
        // Convert the local time inputs to Unix seconds
        let dateLocal = new Date( lockDate + 'T' + lockTime + ':00.000Z' );
        let lockTimeSeconds = Math.round( (dateLocal.getTime() + this._offsetMilliseconds) / 1000 );
        
        // Generate P2SH CLTV redeemScript and address, spendable by a newly generated private key
        let bitcoreLib = this.getBitcoreLib();
        let privateKey = new bitcoreLib.PrivateKey();
        let redeemScript = this._timeLockService.buildRedeemScript( lockTimeSeconds, privateKey );


        let redeemData = {
            redeemKey: privateKey.toWIF(),
            redeemScript: redeemScript.toString(),
        };
        this._dialog.open( CreateAddressConfirmDialog, {
            data: {
                lockTime: new Date( lockTimeSeconds * 1000 ),
                p2shAddress: bitcoreLib.Address.payingTo( redeemScript ).toString(),
                redeemJSON: JSON.stringify( redeemData )
            }
        });
    }


    public showBalance( p2shAddress ) {
        let bitcoreLib = this.getBitcoreLib();

        this._blockchainService.getUTXOs( p2shAddress )
        .then( (utxos: any[]) => {
            // Add the available satoshis from all UTXOs
            let totalSatoshis = utxos.reduce( (total, utxo) => total + utxo.satoshis, 0 );
            this._dialog.open( BasicDialog, { data: {
                title: 'Balance of time-locked address',
                body: bitcoreLib.Unit.fromSatoshis(totalSatoshis).toBTC() + ' ' + this._blockchainService.getBlockchainType().shortName
            }});
        })
        .catch( err => {
            console.error( err );
        });
    }


    public redeem( redeemDataJSON: string, toAddress: string ) {
        let data = JSON.parse( redeemDataJSON );
        this.redeemToAddress( data.redeemScript, data.redeemKey, toAddress );
    }
    

    // @@ Also I should put the scriptSig conditions on the cheque (what is added before redeemScript)
    public redeemToAddress( fromRedeemScript: string, redeemerPrivateKeyWIF: string, toAddress: string ) {
        let bitcoreLib = this.getBitcoreLib();

        let redeemScript = bitcoreLib.Script( fromRedeemScript );
        let p2shAddress = bitcoreLib.Address.payingTo( redeemScript ).toString();
        let privateKey = new bitcoreLib.PrivateKey( redeemerPrivateKeyWIF );

        this._blockchainService.getUTXOs( p2shAddress )
        .then( (utxos:any[]) => this.buildRedeemTx(redeemScript, privateKey, toAddress, utxos) )
        .then( tx => this._blockchainService.broadcastTx(tx) )
        .then( newTxId => {
            this._dialog.open( BasicDialog, { data: {
                title: 'Success',
                body: 'Transaction ID: ' + ( newTxId.result || newTxId ) // the format of the response can vary between BTC & BCH
            }});
        })
        .catch( errs => {
            // `errs` will be an array of errors returned by the many insight servers we query.
            // If an error is a string, we want to display it.
            let stringError = errs.find( err => typeof err === 'string' );
            if ( stringError === undefined ) {
                stringError = errs[0].message ? errs[0].message : JSON.stringify( errs[0] );
            }
            
            this._dialog.open( BasicDialog, { data: {
                title: 'Error',
                body: stringError
            }});
        });
    }


    //QRCode.toDataURL( address.toString(), {width: 800} )

    private buildRedeemTx(
        redeemScript: Bitcore.Script|BitcoreCash.Script,
        redeemerPrivateKey: Bitcore.PrivateKey|BitcoreCash.PrivateKey,
        toAddress: string,
        utxos: any[]
    ): Bitcore.Transaction|BitcoreCash.Transaction {

        let bitcoreLib = this.getBitcoreLib();

        return new Promise( (resolve, reject) => {
            if ( utxos.length === 0 ) {
                return reject( 'Empty! No UTXOs!' );
            }

            this._blockchainService.getFeeRates().then( rates => {
        
                try {
                    // Extract the time lock expiry from the script
                    var timeLockBuf = redeemScript.chunks[0].buf;
                    var lockTimeSeconds = bitcoreLib.crypto.BN.fromBuffer( timeLockBuf, {endian: 'little'} ).toNumber();
                    
                    // Find the total amount avaialble to spend
                    let totalSatoshis = utxos.reduce( (total, utxo) => total + utxo.satoshis, 0 );
            
                    // Calculate a fee in Satoshis
                    let txSizeBytes = this._timeLockService.getEstimatedTxSize( utxos.length );
                    let feePerByte = rates.high; // @@ use a high fee for now
                    let fee = Math.round( feePerByte * txSizeBytes );
            
                    // Build the transaction to redeem the coins
                    let tx = new bitcoreLib.Transaction()
                    .from( utxos )
                    .to( toAddress, totalSatoshis - fee )
                    // Must include nLockTime in order to spend CLTV-locked coins. Add one second to the lockTime for good measure
                    .lockUntilDate( new Date((lockTimeSeconds+1) * 1000) );
                    
                    // If sequenceNumber is the default value, nLockTime will be ignored and the CLTV opcode will cause the tx to fail
                    tx.inputs.forEach( input => input.sequenceNumber = 0 );

                    // Now that the transaction is completely built except for signatures, sign the inputs and replace the
                    // scriptSig on the inputs with new ones that will be able to spend the coins.
                    tx.inputs.forEach( (input, i) => input.setScript(this._timeLockService.buildScriptSig( tx, i, redeemerPrivateKey, redeemScript )) );

                    resolve( tx );
                } catch( e ) {
                    reject( e );
                }
            });
        });
    }

    private getBitcoreLib() {
        return this._blockchainService.getBlockchainType().bitcoreLib;
    }

    ngOnInit() {
    }
}


// @@ temporary modals.
@Component({
    selector: 'createAddressConfirmDialog',
    styles: [`
    mat-form-field { width: 100% }
    `],
    template: `
    <h1 mat-dialog-title>Time-locked address created successfully</h1>
    <div mat-dialog-content>
        <mat-form-field>
            <input matInput readonly [(ngModel)]="data.p2shAddress"
             placeholder="Send coins to this address to lock them until {{data.lockTime.toLocaleString()}}">
        </mat-form-field>
        <mat-form-field>
            <textarea matInput readonly matTextareaAutosize [(ngModel)]="data.redeemJSON"
             placeholder="The data below is required to redeem the coins"></textarea>
        </mat-form-field>
    </div>
    <div mat-dialog-actions>
        <button mat-button color="accent" mat-dialog-close cdkFocusInitial>Close</button>
    </div>    
    `,
})
export class CreateAddressConfirmDialog {
    constructor(
        public dialogRef: MatDialogRef<CreateAddressConfirmDialog>,
        @Inject(MAT_DIALOG_DATA) public data: any ) {}
}


@Component({
    selector: 'basicDialog',
    template: `
    <h1 mat-dialog-title>{{data.title}}</h1>
    <div mat-dialog-content>
        {{data.body}}
    </div>
    <div mat-dialog-actions>
        <button mat-button color="accent" mat-dialog-close cdkFocusInitial>Close</button>
    </div>    
    `,
})
export class BasicDialog {
    constructor(
        public dialogRef: MatDialogRef<BasicDialog>,
        @Inject(MAT_DIALOG_DATA) public data: any ) {}
}