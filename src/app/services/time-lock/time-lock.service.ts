import { Injectable } from '@angular/core';
import { BlockchainService } from '../blockchain/blockchain.service';
import { BlockchainForks } from '../../models/blockchain-forks';
import { TimeLockTypes } from '../../models/time-lock-types';
import * as Bitcore from 'bitcore-lib';
import * as BitcoreCash from 'bitcore-lib-cash';

@Injectable({
    providedIn: 'root'
})
export class TimeLockService {

    private _currentTimeLockType = TimeLockTypes.PKH;

    constructor( private _blockchainService: BlockchainService ) { }

    public setTimeLockType( type: string ) {
        if ( [TimeLockTypes.PK, TimeLockTypes.PKH].indexOf(type) === -1 ) {
            throw( 'Invalid timeLockType: ' + type );
        }
        this._currentTimeLockType = type;
    }

    public getTimeLockType(): string {
        return this._currentTimeLockType;
    }

    /**
     * Estimates the final size in bytes of a transaction which spends coins from a time-locked P2SH address.
     * @param {number} numUTXOs
     * @returns {number} The estimated total number of bytes.
     */
    public getEstimatedTxSize( numUTXOs: number ): number {
        if ( this._currentTimeLockType === TimeLockTypes.PK ) {
            // The size is roughly 156 bytes/UTXO, plus 45.
            return 45 + 156 * numUTXOs;

        } else if ( this._currentTimeLockType === TimeLockTypes.PKH ) {
            // The size is roughly 180 bytes/UTXO, plus 45.
            return 45 + 180 * numUTXOs;
        }
    }

    /**
     * Builds the redeemScript for a new time-locked P2SH.
     * @param {number} timeLockInSeconds The time that the coins sent to this P2SH will be available to spend.
     *  The number should represent the seconds since 1970-01-01 00:00:00 UTC.
     * @param {Bitcore.PrivateKey} payTo The private key that can spend the coins sent to this P2SH.
     * @returns {Bitcore.Script} The redeemScript.
     */
    public buildRedeemScript( timeLockInSeconds: number, payTo: Bitcore.PrivateKey|BitcoreCash.PrivateKey ): Bitcore.Script|BitcoreCash.Script {
        let bitcoreLib = this.getBitcoreLib();
        let script = bitcoreLib.Script()
        .add( bitcoreLib.crypto.BN.fromNumber( timeLockInSeconds ).toScriptNumBuffer() )
        .add( 'OP_CHECKLOCKTIMEVERIFY')
        .add( 'OP_DROP' );

        if ( this._currentTimeLockType === TimeLockTypes.PK ) {
            return script.add( new Buffer(payTo.toPublicKey().toBuffer()) )
            .add( 'OP_CHECKSIG' );

        } else if ( this._currentTimeLockType === TimeLockTypes.PKH ) {
            return script.add( bitcoreLib.Script.buildPublicKeyHashOut(payTo.toPublicKey().toAddress()) );
        }
    }

    /**
     * Builds a scriptSig which can be used to spend coins from a tx that sent coins to a time-locked P2SH
     * @param {Bitcore.Transaction} tx The transaction that needs signing. The transaction must be fully built except for scriptSigs.
     * @param {number} inputIndex The index of the input that needs signing.
     * @param {Bitcore.PrivateKey} privateKey The private key to sign the transaction with.
     * @param {Bitcore.Script} redeemScript The redeemScript of the P2SH that you are trying to spend coins from
     * @returns {Bitcore.Script} The scriptSig which will need to be associated with the input at the given index.
     */
    public buildScriptSig(
        tx: Bitcore.Transaction|BitcoreCash.Transaction,
        inputIndex: number,
        privateKey: Bitcore.PrivateKey|BitcoreCash.PrivateKey,
        redeemScript: Bitcore.Script|BitcoreCash.Script
    ): Bitcore.Script|BitcoreCash.Script {
        let bitcoreLib = this.getBitcoreLib();
        let blockchainType = this._blockchainService.getBlockchainType();
        let args = [ tx, privateKey, blockchainType.sigType, inputIndex, redeemScript ];

        // BCH requires adding number of satoshis to the sign method
        if ( blockchainType.fork === BlockchainForks.BCH ) {
            args.push( bitcoreLib.crypto.BN.fromNumber(tx.inputs[inputIndex].output.satoshis) );
        }
        
        let signature = bitcoreLib.Transaction.sighash.sign( ...args );

        if ( this._currentTimeLockType === TimeLockTypes.PK ) {
            return bitcoreLib.Script()
            .add( signature.toTxFormat() )
            .add( redeemScript.toBuffer() );

        } else if ( this._currentTimeLockType === TimeLockTypes.PKH ) {
            return bitcoreLib.Script()
            .add( signature.toTxFormat() )
            .add( privateKey.toPublicKey().toBuffer() )
            .add( redeemScript.toBuffer() );
        }
    }

    private getBitcoreLib() {
        return this._blockchainService.getBlockchainType().bitcoreLib;
    }
}
