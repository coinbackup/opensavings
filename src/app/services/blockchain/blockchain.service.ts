import { Injectable } from '@angular/core';
import { BlockchainType } from '../../models/blockchain-types';
import { NetworkService } from '../network/network.service';
import { AppError } from '../../models/error-types';
import * as Bitcore from 'bitcore-lib';
import * as BitcoreCash from 'bitcore-lib-cash';

// BlockchainService queries Insight endpoints and handles data from them.
// This is a service which combines several potentially unreliable endpoints into something that acts like one reliable endpoint.
// For the rest of the app, this service acts as the main interface to the blockchain.

@Injectable({
    providedIn: 'root'
})
export class BlockchainService {

    public static instance: BlockchainService;

    // Select BTC by default
    private _currentChain: BlockchainType = BlockchainType.BTC;

    constructor( private _networkService: NetworkService ) {
        BlockchainService.instance = this;
    }

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
        let serviceRequests = this._currentChain.explorers.map( explorer => explorer.getUTXOs(address) );
        return this._networkService.raceToSuccess( serviceRequests )
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
        // Use whichever service returns fee information first.
        let serviceRequests = this._currentChain.explorers.map( explorer => explorer.getFeeRates() );
        return this._networkService.raceToSuccess( serviceRequests )
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


    public broadcastTx( serializedTx: Bitcore.Transaction|BitcoreCash.Transaction ): Promise<any> {
        // POST the tx to insight services.
        let serviceRequests = this._currentChain.explorers.map( explorer => explorer.broadcastTx(serializedTx) );
        return this._networkService.raceToSuccess( serviceRequests )
        .catch( err => {
            if ( err.type === AppError.TYPES.SERVER ) {
                // The server will return an error if the transaction is invalid, i.e. if the tx's
                // nLockTime is in the future, or if nLockTime is smaller than the CLTV value,
                // or if an address is invalid, or it's a double-spend attempt, etc.
                err.message = 'Error broadcasting transaction: ' + err.message;
            } else if ( err.type === AppError.TYPES.FETCH ) {
                err.message = 'Error: could not connect to blockchain nodes. Is your internet connection working? (' + err.message + ')';
            } else {
                err.message = 'Unexpected error broadcasting transaction: ' + err.message;
            }
            throw err;
        });
    }

}
