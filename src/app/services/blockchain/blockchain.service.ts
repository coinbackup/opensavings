import { Injectable } from '@angular/core';
import { BlockchainType, BlockchainTypes } from '../../models/blockchain-types';
import { NetworkService } from '../network/network.service';
import { AppError } from '../../models/error-types';
import * as Bitcore from 'bitcore-lib';
import * as BitcoreCash from 'bitcore-lib-cash';

@Injectable({
    providedIn: 'root'
})
export class BlockchainService {

    // Select BTC by default
    private _currentChain: BlockchainType = BlockchainTypes.BTC;

    constructor( private _networkService: NetworkService ) {}

    public setBlockchainType( chain: BlockchainType ) {
        this._currentChain = chain;
        chain.bitcoreLib.Networks.defaultNetwork = chain.networkType;
    }

    public getBlockchainType(): BlockchainType {
        return this._currentChain;
    }

    /**
     * Checks the blockchain for unspent transaction outputs for a given address.
     * @param {string} address A pubKeyHash or scriptHash address.
     * @returns {Promise} A Promise which resolves with an array of UTXO objects, or rejects with an error.
     */
    public getUTXOs( address: string ): Promise<any> {
        // Query all services and return data from the fastest one
        let serviceRequests = this._currentChain.insightURLs.map(
            url => this._networkService.fetchJSON( url + '/api/addr/' + address + '/utxo' )
        );
        return this._networkService.raceToSuccess( serviceRequests ).
        then( utxos => {
            // For BCH, some servers don't return addresses in cashAddr format, and this breaks the code. The formatting needs to be fixed.
            utxos.forEach( utxo => utxo.address = this._currentChain.fixAddress(utxo.address) );
            return utxos;
        })
        .catch( err => {
            if ( err.type === AppError.TYPES.SERVER ) {
                err.message = 'Error while getting unspent transaction outputs: ' + err.message;
            } else if ( err.type === AppError.TYPES.FETCH ) {
                err.message = 'Error: could not connect to blockchain nodes. Is your internet connection working? (' + err.message + ')';
            } else {
                err.message = 'Unexpected error while attempting to get unspent transaction outputs: ' + err.message;
            }
            throw err;
        });
    }

    // Returns a promise which resolves with an object containing { high, medium, low }, which are fees in satoshis/byte
    // for a transaction which would have high, medium, or low priority. Note that the values may not be integers.
    public getFeeRates(): Promise<any> {
        // Find the estimated fees in satoshis/byte to get the transaction included in:
        // The next block, the next 4 blocks, or the next 8 blocks

        // Get all three fee estmations from the same service, but use whichever service returns all three first.
        let serviceRequests = this._currentChain.insightURLs.map( url => {
            return Promise.all([
                this._networkService.fetchJSON( url + '/api/utils/estimatefee?nbBlocks=2' ),
                this._networkService.fetchJSON( url + '/api/utils/estimatefee?nbBlocks=4' ),
                this._networkService.fetchJSON( url + '/api/utils/estimatefee?nbBlocks=8' )
            ]);
        });

        return this._networkService.raceToSuccess( serviceRequests )
        .then( fees => {
            // Convert the somewhat odd response format into an object with high/medium/low properties.
            // Also convert the returned BTC/kb units into satoshis/byte.
            let convertedFees = [ this.btcPerKbToSatoshisPerByte( fees[0]['2'] ), this.btcPerKbToSatoshisPerByte( fees[1]['4'] ), this.btcPerKbToSatoshisPerByte( fees[2]['8'] ) ];
            // Sometimes the values can be negative (not sure why???). Correct these.
            if ( convertedFees[1] <= 0 ) convertedFees[1] = convertedFees[2];
            if ( convertedFees[0] <= 0 ) convertedFees[0] = convertedFees[1];
            if ( convertedFees[0] <= 0 ) {
                throw new AppError(AppError.TYPES.SERVER, 'Fees reported as negative');
            }
            return { high: convertedFees[0], medium: convertedFees[1], low: convertedFees[2] };
        })
        .catch( err => {
            if ( err.type === AppError.TYPES.SERVER ) {
                err.message = 'Error getting current transaction fees: ' + err.message;
            } else if ( err.type === AppError.TYPES.FETCH ) {
                err.message = 'Error: could not connect to blockchain nodes. Is your internet connection working? (' + err.message + ')';
            } else {
                err.message = 'Unexpected error while getting current transaction fees: ' + err.message;
            }
            throw err;
        });
    }

    public broadcastTx( tx: Bitcore.Transaction|BitcoreCash.Transaction ): Promise<any> {
        // We can't verify this tx before broadcasting, because bitcore can't auto-verify nonstandard txs.
        // Pass true to serialize() to skip all verification tests.
        let serializedTx = tx.serialize( true );
        console.log( serializedTx );
        // POST the tx to insight services.
        let serviceRequests = this._currentChain.insightURLs.map(
            url => this._networkService.postJSON( url + '/api/tx/send', { rawtx: serializedTx } )
        );
        return this._networkService.raceToSuccess( serviceRequests ).then(
            // the format of the response can vary between BTC & BCH
            response => response.txid.result || response.txid,
            err => {
                if ( err.type === AppError.TYPES.SERVER ) {
                    // Check for 'nonfinal' or 'non-final' in the returned error message.
                    if ( err.message.toLowerCase().search(/non-?final/) >= 0 ) {
                        err.message = 'Cannot redeem coins: the time lock has not yet expired.';
                    } else {
                        err.message = 'Error broadcasting transaction: ' + err.message;
                    }
                } else if ( err.type === AppError.TYPES.FETCH ) {
                    err.message = 'Error: could not connect to blockchain nodes. Is your internet connection working? (' + err.message + ')';
                } else {
                    err.message = 'Unexpected error broadcasting transaction: ' + err.message;
                }
                throw err;
            }
        );
    }

    private btcPerKbToSatoshisPerByte( btcPerKb: number ): number {
        return this._currentChain.bitcoreLib.Unit.fromBTC( btcPerKb ).toSatoshis() / 1000;
    }

}
