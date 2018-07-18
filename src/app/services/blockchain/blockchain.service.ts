import { Injectable } from '@angular/core';
import { BlockchainType, BlockchainTypes } from '../../models/blockchain-types';
import { NetworkService } from '../network/network.service';
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
        return this._networkService.raceToSuccess( serviceRequests );
    }

    // Returns a promise which resolves with an object containing { high, medium, low }, which are fees in satoshis/byte
    // for a transaction which would have high, medium, or low priority. Note that the values may not be integers.
    public getFeeRates(): Promise<any> {
        // Find the estimated fees in satoshis/byte to get the transaction included in:
        // The next block, the next 3 blocks, or the next 6 blocks
        return new Promise( (resolve, reject) => {
            setTimeout( () => reject( 'Timed out.' ), this._networkService.timeoutMs );

            // Get all three fee estmations from the same service, but use whichever service returns all three first.
            let serviceRequests = this._currentChain.insightURLs.map( url => {
                return Promise.all([
                    this._networkService.fetchJSON( url + '/api/utils/estimatefee?nbBlocks=2' ),
                    this._networkService.fetchJSON( url + '/api/utils/estimatefee?nbBlocks=4' ),
                    this._networkService.fetchJSON( url + '/api/utils/estimatefee?nbBlocks=8' )
                ]);
            });
            this._networkService.raceToSuccess( serviceRequests )
            .then( fees => {
                // Convert the somewhat odd response format into an object with high/medium/low properties.
                // Also convert the returned BTC/kb units into satoshis/byte.
                resolve({
                    high: this.btcPerKbToSatoshisPerByte( fees[0]['2'] ),
                    medium: this.btcPerKbToSatoshisPerByte( fees[1]['4'] ),
                    low: this.btcPerKbToSatoshisPerByte( fees[2]['8'] )
                });
            })
            .catch( err => reject(err) );
        });
    }

    public broadcastTx( tx: Bitcore.Transaction|BitcoreCash.Transaction ): Promise<any> {
        // We can't verify this tx before broadcasting, because bitcore can't auto-verify nonstandard txs.
        // Pass true to serialize() to skip all verification tests.
        let serializedTx = tx.serialize( true );
        // POST the tx to insight services.
        let serviceRequests = this._currentChain.insightURLs.map(
            url => this._networkService.postJSON( url + '/api/tx/send', { rawtx: serializedTx } )
        );
        return this._networkService.raceToSuccess( serviceRequests ).then( response => response.txid );
    }

    private btcPerKbToSatoshisPerByte( btcPerKb: number ): number {
        return this._currentChain.bitcoreLib.Unit.fromBTC( btcPerKb ).toSatoshis() / 1000;
    }

}
