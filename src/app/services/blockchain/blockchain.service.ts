import { Injectable } from '@angular/core';
import { BlockchainType } from '../../models/blockchain-type';
import { NetworkService } from '../network/network.service';
import * as Bitcore from 'bitcore-lib';

@Injectable({
    providedIn: 'root'
})
export class BlockchainService {

    // Define differences between different blockchains
    readonly blockchainTypes = {
        BTC: new BlockchainType(
            Bitcore.Networks.livenet,
            ['https://insight.bitpay.com',
             'https://btc.blockdozer.com',
             'https://blockexplorer.com',
             'https://www.localbitcoinschain.com'
            ]
        ),
        tBTC: new BlockchainType(
            Bitcore.Networks.testnet,
            ['https://test-insight.bitpay.com',
             'https://tbtc.blockdozer.com',
             'https://testnet.blockexplorer.com'
            ]
        ),
        BCH: new BlockchainType(
            Bitcore.Networks.livenet,
            ['https://bch-insight.bitpay.com',
             'https://blockdozer.com',
             'https://bitcoincash.blockexplorer.com'
            ]
        ),
        tBCH: new BlockchainType(
            Bitcore.Networks.testnet,
            ['https://test-bch-insight.bitpay.com',
             'https://tbch.blockdozer.com'
             // There's probably a test-bch blockexplorer site, but I coudln't find it...
            ]
        )
    };

    private currentChain: BlockchainType;

    constructor( private networkService: NetworkService ) {
    }

    // chain must be one of blockchainTypes
    public setBlockchain( chain: BlockchainType ) {
        this.currentChain = chain;
        Bitcore.Networks.defaultNetwork = chain.networkType;
    }

    /**
     * Checks the blockchain for unspent transaction outputs for a given address.
     * @param {string} address A pubKeyHash or scriptHash address.
     * @returns {Promise} A Promise which resolves with an array of UTXO objects, or rejects with an error.
     */
    public getUTXOs( address: string ): Promise<any> {
        this.checkChain();
        // Query all services and return data from the fastest one
        let serviceRequests = this.currentChain.insightURLs.map(
            url => this.networkService.fetchJSON( url + '/api/addr/' + address + '/utxo' )
        );
        return this.networkService.raceToSuccess( serviceRequests );
    }

    // Returns a promise which resolves with an object containing { high, medium, low }, which are fees in satoshis/byte
    // for a transaction which would have high, medium, or low priority. Note that the values may not be integers.
    public getFeeRates(): Promise<any> {
        this.checkChain();
        // Find the estimated fees in satoshis/byte to get the transaction included in:
        // The next block, the next 3 blocks, or the next 6 blocks
        return new Promise( (resolve, reject) => {
            setTimeout( () => reject( 'Timed out.' ), this.networkService.timeoutMs );

            // Get all three fee estmations from the same service, but use whichever service returns all three first.
            let serviceRequests = this.currentChain.insightURLs.map( url => {
                return Promise.all([
                    this.networkService.fetchJSON( url + '/api/utils/estimatefee?nbBlocks=2' ),
                    this.networkService.fetchJSON( url + '/api/utils/estimatefee?nbBlocks=4' ),
                    this.networkService.fetchJSON( url + '/api/utils/estimatefee?nbBlocks=8' )
                ]);
            });
            this.networkService.raceToSuccess( serviceRequests )
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

    public broadcastTx( tx: Bitcore.Transaction ): Promise<any> {
        this.checkChain();
        // We can't verify this tx before broadcasting, because bitcore can't auto-verify nonstandard txs.
        // Pass true to serialize() to skip all verification tests.
        let serializedTx = tx.serialize( true );
        // POST the tx to insight services.
        let serviceRequests = this.currentChain.insightURLs.map(
            url => this.networkService.postJSON( url + '/api/tx/send', { rawtx: serializedTx } )
        );
        return this.networkService.raceToSuccess( serviceRequests ).then( response => response.txid );
    }

    private checkChain() {
        if ( this.currentChain === undefined ) {
            throw( 'You must select a blockchain with `BlockchainService.setBlockchain()`' );
        }
    }

    private btcPerKbToSatoshisPerByte( btcPerKb: number ): number {
        return Bitcore.Unit.fromBTC( btcPerKb ).toSatoshis() / 1000;
    }

}
