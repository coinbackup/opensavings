import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material';
import { BasicDialog } from '../../dialogs/basic-dialog/basic-dialog.component';
import { ConfirmDialog } from '../../dialogs/confirm-dialog/confirm-dialog.component';
import { AppError } from '../../models/error-types';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { TimeLockService } from '../../services/time-lock/time-lock.service';
import { BlockchainType } from '../../models/blockchain-types';
import { QrScannerComponent } from '../qr-scanner/qr-scanner.component';
import { SmoothScroll } from '../../services/smooth-scroll/smooth-scroll.service';
import * as Bitcore from 'bitcore-lib';
import * as BitcoreCash from 'bitcore-lib-cash';
import { FeeRates } from '../../models/api-responses';
import { NumberInputDialog } from '../../dialogs/number-input-dialog/number-input-dialog.component';

@Component({
    selector: 'app-redeem',
    templateUrl: './redeem.component.html',
    styleUrls: ['./redeem.component.scss']
})
export class RedeemComponent implements OnInit {

    redeemJSON: string;
    destinationAddress: string;
    buttonDisabled: boolean = false;
    newTxId;
    qrScanner = QrScannerComponent.instance;

    private selectedBlockchain: BlockchainType;

    constructor( private blockchainService: BlockchainService, private timeLockService: TimeLockService, private dialog: MatDialog, private smoothScroll: SmoothScroll ) {
        QrScannerComponent.onQrScanFailure = message => this.showErrorModal( new AppError(AppError.TYPES.OTHER, message) );
    }

    public redeem( redeemDataJSON: string, toAddress: string ) {
        this.buttonDisabled = true;
        try {
            // Parse and verify the redeemData
            let data = JSON.parse( redeemDataJSON );
            let keys = Object.keys( data );
            let expectedKeys = [ 'version', 'blockchain', 'redeemScript', 'redeemKey' ];
            expectedKeys.forEach( expectedKey => {
                if ( keys.indexOf(expectedKey) === -1 ) throw new Error( 'Property "' + expectedKey + '" not found in input data' );
            });
            
            this.redeemToAddress( data.version, data.blockchain, data.redeemScript, data.redeemKey, toAddress )
            .then( newTxId => {
                if ( newTxId ) { // newTxId will not be set if 'cancel' was clicked on the confirm dialog
                    this.newTxId = newTxId;
                    setTimeout( () => {
                        this.smoothScroll.to( document.getElementById('success') );
                    }, 100 );
                }
            })
            .catch( err => {
                // if `serializedTx` is defined, then only the last step failed-
                // instruct the user to broadcast the tx manually
                if ( err.serializedTx ) {
                    this.dialog.open( BasicDialog, { data: {
                        title: 'Error',
                        icon: './assets/img/icons/x.svg',
                        body: `<p>Couldn't connect to APIs to broadcast the transaction. Copy the transaction code below and visit `
                         + `<a href="${this.selectedBlockchain.broadcastFallbackUrl}" target="_blank">${this.selectedBlockchain.broadcastFallbackUrl}</a> `
                         + `to broadcast your transaction and redeem your coins.</p>`,
                        infoToCopy: err.serializedTx
                    }});
                } else {
                    this.showErrorModal( err );
                }
            })
            ['finally']( () => this.buttonDisabled = false );

        } catch( e ) {
            this.showErrorModal( new AppError(AppError.TYPES.OTHER, 'Malformed redeem data. Did you copy/scan it correctly? (' + e.message + ')') );
            this.buttonDisabled = false;
        }
    }
    

    // Should I put the scriptSig conditions on the printed paper (what is added before redeemScript)?
    private redeemToAddress( version: number, blockchain: string, fromRedeemScript: string, redeemerPrivateKeyWIF: string, toAddress: string ) {
        // Do nothing with the version number yet. We'll use it if the code changes drastically

        // Switch to the defined blockchain
        let chain = BlockchainType[blockchain];
        if ( chain === undefined ) throw new Error( 'Invalid blockchain type: "' + blockchain +'"' );
        this.selectedBlockchain = chain;
        this.blockchainService.setBlockchainType( chain );

        let bitcoreLib = chain.bitcoreLib;

        try {
            // Get UTXOs and build a transaction with them, sending the coins to the destination address
            let redeemScript = bitcoreLib.Script( fromRedeemScript );
            let p2shAddress = bitcoreLib.Address.payingTo( redeemScript ).toString();
            let privateKey = new bitcoreLib.PrivateKey( redeemerPrivateKeyWIF );
            // remove any prefix like 'bitcoincash:' from the wallet address
            toAddress = toAddress.replace( /^.*:/, '' );
            
            return this.blockchainService.getUTXOs( p2shAddress )
            .then( (utxos:any[]) => this.buildRedeemTxWrapper(chain, redeemScript, privateKey, toAddress, utxos) );
        } catch( e ) {
            throw e;
        }
    }

    private buildRedeemTxWrapper(
        chain: BlockchainType,
        redeemScript: Bitcore.Script|BitcoreCash.Script,
        redeemerPrivateKey: Bitcore.PrivateKey|BitcoreCash.PrivateKey,
        toAddress: string,
        utxos: any[],
        fee?: number
    ) {
        return this.buildRedeemTx( redeemScript, redeemerPrivateKey, toAddress, utxos, fee )
        .then( txDetails => {
            return this.blockchainService.getUSDRate()
            .catch( err => null ) // if we couldn't get the rate, just don't show it in the UI
            .then( (USDPerCoin: number) => {
                txDetails.units = chain.shortName;
                txDetails.USDPerCoin = USDPerCoin;
                let dialogRef = this.dialog.open( ConfirmDialog, { data: txDetails } );
                return dialogRef.afterClosed().toPromise()
                .then( result => {
                    if ( result ) {
                        if ( result === 'custom-fee' ) {
                            // show a dialog to enter a custom fee and rebuild and re-confirm the transaction
                            let dialogRef = this.dialog.open( NumberInputDialog, {data: {
                                message: 'Enter a custom fee',
                                inputLabel: 'Fee in satoshis/byte',
                                defaultValue: txDetails.feePerByte
                            }});
                            return dialogRef.afterClosed().toPromise()
                            .then( result => {
                                // use either the newly defined fee rate or the fee rate from the previously built transaction
                                let customFee = result ? parseInt(result) : txDetails.feePerByte;
                                return this.buildRedeemTxWrapper( chain, redeemScript, redeemerPrivateKey, toAddress, utxos, customFee );
                            });
                        } else {
                            // confirmed.
                            return this.blockchainService.broadcastTx( txDetails.serializedTx )
                            .catch( err => {
                                // attach the serialized tx to the error and pass it upwards
                                err.serializedTx = txDetails.serializedTx;
                                throw err;
                            });
                        }
                    }
                    // (otherwise, resolve with nothing, which indicates that 'cancel' was clicked)
                });
            });
        });
    }

    private buildRedeemTx(
        redeemScript: Bitcore.Script|BitcoreCash.Script,
        redeemerPrivateKey: Bitcore.PrivateKey|BitcoreCash.PrivateKey,
        toAddress: string,
        utxos: any[],
        fee?: number
    ): any {

        let bitcoreLib = this.selectedBlockchain.bitcoreLib;

        if ( utxos.length === 0 ) {
            return Promise.reject( new AppError(AppError.TYPES.NO_BALANCE, 'Error redeeming coins: the time-locked address has no coins to spend.') );
        }

        // Verify that the toAddress is valid
        let addressError = bitcoreLib.Address.getValidationError( toAddress, bitcoreLib.Networks.defaultNetwork );
        if ( addressError ) {
            return Promise.reject( new AppError(AppError.TYPES.OTHER, 'The destination address is invalid. (' + addressError.message + ')') );
        }

        // either use the manually entered fee, or try to automatically determine a fee
        return ( fee ? Promise.resolve({high:fee, medium:fee, low:fee}) : this.blockchainService.getFeeRates() )
        .catch( e => {
            // if fees could not be obtained, open a dialog to ask the user to define a fee.
            let dialogRef = this.dialog.open( NumberInputDialog, {data: {
                message: 'Unable to automatically find network fee rates. Please enter a fee amount.',
                inputLabel: 'Fee in satoshis/byte'
            }});
            return dialogRef.afterClosed().toPromise().then( result => {
                if ( result ) {
                    let val = parseInt( result );
                    return { high: val, medium: val, low: val };
                } else {
                    throw( new AppError(AppError.TYPES.OTHER, 'Unable to redeem the locked coins unless a fee is defined.') );
                }
            });
        }).then( (rates: FeeRates) => {
            try {
                // Extract the time lock expiry from the script
                var timeLockBuf = redeemScript.chunks[0].buf;
                var lockTimeSeconds = bitcoreLib.crypto.BN.fromBuffer( timeLockBuf, {endian: 'little'} ).toNumber();
                if ( new Date(lockTimeSeconds*1000) > new Date() ) {
                    throw( new AppError(AppError.TYPES.OTHER, 'Cannot redeem coins: the time lock has not yet expired.') );
                }

                // Find the total amount avaialble to spend
                let totalSatoshis = utxos.reduce( (total, utxo) => total + utxo.satoshis, 0 );
        
                // Calculate a fee in Satoshis
                let txSizeBytes = this.timeLockService.getEstimatedTxSize( utxos.length );
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
                tx.inputs.forEach( (input, i) => input.setScript(this.timeLockService.buildScriptSig( tx, i, redeemerPrivateKey, redeemScript )) );

                // We can't verify this tx, because bitcore can't auto-verify nonstandard txs.
                // Pass true to serialize() to skip all verification tests.
                let serializedTx = tx.serialize( true );
                console.log( 'Serialized transaction: ' + serializedTx );

                // resolve with all the details of the transaction
                return{
                    toAddress: toAddress,
                    total: bitcoreLib.Unit.fromSatoshis( totalSatoshis - fee ).toBTC(),
                    fee: bitcoreLib.Unit.fromSatoshis( fee ).toBTC(),
                    serializedTx: serializedTx,
                    feePerByte: feePerByte
                };
            } catch( e ) {
                throw( new AppError(AppError.TYPES.OTHER, 'Unexpected error building a transaction: ' + e.message) );
            }
        });
    }

    private scanQR( modelName ) {
        QrScannerComponent.onQrScanSuccess = decoded => this[modelName] = decoded;
        QrScannerComponent.instance.scanQR();
    }
    private onQRFileChange( modelName, targetElement ) {
        QrScannerComponent.onQrScanSuccess = decoded => this[modelName] = decoded;
        QrScannerComponent.instance.onQRFileChange( targetElement );
    }

    private showErrorModal( error: AppError ) {
        this.dialog.open( BasicDialog, { data: {
            title: 'Error',
            icon: './assets/img/icons/x.svg',
            body: error.message
        }});
    }

    ngOnInit() {
    }

}

