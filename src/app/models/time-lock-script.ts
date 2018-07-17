import * as Bitcore from 'bitcore-lib';

export interface TimeLockScriptInterface {
    /**
     * Estimates the final size in bytes of a transaction which spends coins from a time-locked P2SH address.
     * @param {number} numUTXOs
     * @returns {number} The estimated total number of bytes.
     */
    getEstimatedTxSize( numUTXOs: number ): number;

    /**
     * Builds the redeemScript for a new time-locked P2SH.
     * @param {number} timeLockInSeconds The time that the coins sent to this P2SH will be available to spend.
     *  The number should represent the seconds since 1970-01-01 00:00:00 UTC.
     * @param {Bitcore.PrivateKey} payTo The private key that can spend the coins sent to this P2SH.
     * @returns {Bitcore.Script} The redeemScript.
     */
    buildRedeemScript( timeLockInSeconds: number, payTo: Bitcore.PrivateKey ): Bitcore.Script;

    /**
     * Builds a scriptSig which can be used to spend coins from a tx that sent coins to a time-locked P2SH
     * @param {Bitcore.Transaction} tx The transaction that needs signing. The transaction must be fully built except for scriptSigs.
     * @param {number} inputIndex The index of the input that needs signing.
     * @param {Bitcore.PrivateKey} privateKey The private key to sign the transaction with.
     * @param {Bitcore.Script} redeemScript The redeemScript of the P2SH that you are trying to spend coins from
     * @returns {Bitcore.Script} The scriptSig which will need to be associated with the input at the given index.
     */
    buildScriptSig( tx: Bitcore.Transaction, inputIndex: number, privateKey: Bitcore.PrivateKey, redeemScript: Bitcore.Script ): Bitcore.Script;
}


// Tools for P2SH built on a CLTV-P2PK-style script.
export class TimeLockPubKey implements TimeLockScriptInterface {

    getEstimatedTxSize( numUTXOs: number ): number {
        // The size is roughly 156 bytes/UTXO, plus 45.
        return 45 + 156 * numUTXOs;
    }

    buildRedeemScript( timeLockInSeconds: number, payTo: Bitcore.PrivateKey ): Bitcore.Script {
        return Bitcore.Script()
        .add( Bitcore.crypto.BN.fromNumber( timeLockInSeconds ).toScriptNumBuffer() )
        .add( 'OP_CHECKLOCKTIMEVERIFY')
        .add( 'OP_DROP' )
        .add( new Buffer(payTo.toPublicKey().toBuffer()) )
        .add( 'OP_CHECKSIG' );
    }

    buildScriptSig( tx: Bitcore.Transaction, inputIndex: number, privateKey: Bitcore.PrivateKey, redeemScript: Bitcore.Script ): Bitcore.Script {
        let signature = Bitcore.Transaction.sighash.sign( tx, privateKey, Bitcore.crypto.Signature.SIGHASH_ALL, inputIndex, redeemScript );
        
        return Bitcore.Script()
        .add( signature.toTxFormat() )
        .add( redeemScript.toBuffer() );
    }
}


// Tools for P2SH built on a CLTV-P2PKH-style script.
export class TimeLockPubKeyHash implements TimeLockScriptInterface {

    getEstimatedTxSize( numUTXOs: number ): number {
        // The size is roughly 180 bytes/UTXO, plus 45.
        return 45 + 180 * numUTXOs;
    }

    buildRedeemScript( timeLockInSeconds: number, payTo: Bitcore.PrivateKey ): Bitcore.Script {
        return Bitcore.Script()
        .add( Bitcore.crypto.BN.fromNumber( timeLockInSeconds ).toScriptNumBuffer() )
        .add( 'OP_CHECKLOCKTIMEVERIFY')
        .add( 'OP_DROP' )
        .add( Bitcore.Script.buildPublicKeyHashOut(payTo.toPublicKey().toAddress()) );
    }

    buildScriptSig( tx: Bitcore.Transaction, inputIndex: number, privateKey: Bitcore.PrivateKey, redeemScript: Bitcore.Script ): Bitcore.Script {
        let signature = Bitcore.Transaction.sighash.sign( tx, privateKey, Bitcore.crypto.Signature.SIGHASH_ALL, inputIndex, redeemScript );
        
        return Bitcore.Script()
        .add( signature.toTxFormat() )
        .add( privateKey.toPublicKey().toBuffer() )
        .add( redeemScript.toBuffer() );
    }
}
