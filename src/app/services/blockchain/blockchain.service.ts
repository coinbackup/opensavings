import { Injectable } from '@angular/core';
import { BlockchainType } from '../../models/blockchain-types';
import { NetworkService } from '../network/network.service';
import { AppError } from '../../models/error-types';
import { UTXO, FeeRates } from '../../models/api-responses';
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
     * Gets the current value of USD/coin.
     */
    public getUSDRate(): Promise<number> {
        return this.queryAllAPIs(
            'canGetUSDRate',
            'getUSDRate',
            [],
            'Error while getting current USD conversion rate',
            'Unexpected error while attempting to get current USD conversion rate'
        );
    }

    /**
     * Checks the blockchain for unspent transaction outputs for a given address.
     * @param {string} address A pubKeyHash or scriptHash address.
     * @returns {Promise<UTXO[]>} A Promise which resolves with an array of UTXO objects, or rejects with an error.
     */
    public getUTXOs( address: string ): Promise<UTXO[]> {
        return this.queryAllAPIs(
            'canGetUTXOs',
            'getUTXOs',
            [address],
            'Error while getting unspent transaction outputs',
            'Unexpected error while attempting to get unspent transaction outputs'
        );
    }

    /**
     * Checks the blockchain for the balance of given address.
     * @param {string} address A pubKeyHash or scriptHash address.
     * @returns {Promise<number>} A Promise which resolves with the number of satoshis available at the address, or rejects with an error.
     */
    public getBalance( address: string ): Promise<number> {
        return this.queryAllAPIs(
            'canGetBalance',
            'getBalance',
            [address],
            'Error while getting balance',
            'Unexpected error while attempting to get balance'
        );
    }

    // Returns a promise which resolves with an object containing { high, medium, low }, which are fees in satoshis/byte
    // for a transaction which would have high, medium, or low priority. Note that the values may not be integers.
    public getFeeRates(): Promise<FeeRates> {
        return this.queryAllAPIs(
            'canGetFeeRates',
            'getFeeRates',
            [],
            'Error getting current transaction fees',
            'Unexpected error while getting current transaction fees'
        );
    }


    public broadcastTx( serializedTx: Bitcore.Transaction|BitcoreCash.Transaction ): Promise<string> {
        return this.queryAllAPIs(
            'canBroadcast',
            'broadcastTx',
            [serializedTx],
            'Error broadcasting transaction',
            'Unexpected error broadcasting transaction'
        );
    }


    // Queries all APIs that have a given feature, and returns the response from whichever one returns a successful message first.
    private queryAllAPIs( APIFeature, APIFunctionName, APIFunctionArgs, serverErrorMessage, fetchErrorMessage ): Promise<any> {
        let serviceRequests = this._currentChain.explorers.filter(
            explorer => explorer[APIFeature]
        ).map(
            explorer => explorer[APIFunctionName]( ...APIFunctionArgs )
        );

        if ( serviceRequests.length === 0 ) {
            return Promise.reject( new Error('No explorers for this blockchain support the feature: ' + APIFeature) );
        }

        return this._networkService.raceToSuccess( serviceRequests )
        .catch( err => {
            if ( err.type === AppError.TYPES.SERVER ) {
                err.message = serverErrorMessage + ': ' + err.message;
            } else if ( err.type === AppError.TYPES.FETCH ) {
                err.message = 'Error: could not connect to blockchain nodes. Is your internet connection working? (' + err.message + ')';
            } else {
                err.message = fetchErrorMessage + ': ' + err.message;
            }
            throw err;
        });
    }

}
