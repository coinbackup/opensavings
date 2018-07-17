import { Injectable } from '@angular/core';
import { BlockchainType } from '../../models/blockchain-type';
import * as Explorers from 'bitcore-explorers';
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
    
    public timeoutMs: number = 10000;

    constructor() {
    }

    // chain must be one of blockchainTypes
    setBlockchain( chain: BlockchainType ) {
        this.currentChain = chain;
        Bitcore.Networks.defaultNetwork = chain.networkType;
    }

    /**
     * Checks the blockchain for unspent transaction outputs for a given address.
     * @param {string} address A pubKeyHash or scriptHash address.
     * @returns {Promise} A Promise which resolves with an array of UTXO objects, or rejects with an error.
     */
    public getUTXOs( address: string ): Promise<any> {
        if ( this.currentChain === undefined ) {
            throw( 'You must select a blockchain with `BlockchainService.setBlockchain()` before calling this method' );
        }
        // Map insight async function to a promise
        var insightPromises = this.currentChain.insightURLs.map( url => {
            return new Promise( (resolve, reject) => {
                new Explorers.Insight( url ).getUnspentUtxos( address, (err, utxos) => {
                    if ( err ) reject( err );
                    else resolve( utxos );
                });
            });
        });

        return this.raceToSuccess( insightPromises, this.timeoutMs );
    }

    // Returns a promise which resolves with an object containing { high, medium, low }, which are fees in satoshis/byte
    // for a transaction which would have high, medium, or low priority. Note that the values may not be integers.
    public getFeeRates(): Promise<any> {
        if ( this.currentChain === undefined ) {
            throw( 'You must select a blockchain with `BlockchainService.setBlockchain()` before calling this method' );
        }
        // Find the estimated fees in satoshis/byte to get the transaction included in:
        // The next block, the next 3 blocks, or the next 6 blocks
        return new Promise( (resolve, reject) => {
            setTimeout( () => reject( 'Timed out.' ), this.timeoutMs );

            // Get all three fee estmations from the same service, but use whichever service returns all three first.
            let serviceRequests = this.currentChain.insightURLs.map( url => {
                return Promise.all([
                    this.fetchJSON( url + '/api/utils/estimatefee?nbBlocks=2' ),
                    this.fetchJSON( url + '/api/utils/estimatefee?nbBlocks=4' ),
                    this.fetchJSON( url + '/api/utils/estimatefee?nbBlocks=8' )
                ]);
            });
            this.raceToSuccess( serviceRequests )
            .then( fees => {
                // Convert the somewhat odd response format into an object with high/medium/low properties.
                // Also convert the returned BTC/kb units into satoshis/byte.
                resolve({
                    high: this.btcPerKbToSatoshisPerByte( fees[0]['2'] ),
                    medium: this.btcPerKbToSatoshisPerByte( fees[1]['3'] ),
                    low: this.btcPerKbToSatoshisPerByte( fees[2]['6'] )
                });
            })
            .catch( err => reject(err) );
        });
    }

    public broadcastTx( tx: Bitcore.Transaction ): Promise<any> {
        if ( this.currentChain === undefined ) {
            throw( 'You must select a blockchain with `BlockchainService.setBlockchain()` before calling this method' );
        }
        // We can't verify this tx before broadcasting, because bitcore can't auto-verify nonstandard txs.
        // Pass true to serialize() to skip all verification tests.
        let serializedTx = tx.serialize( true );
        var insightPromises = this.currentChain.insightURLs.map( url => {
            return new Promise( (resolve, reject) => {
                new Explorers.Insight( url ).broadcast( serializedTx, (error, newTxId) => {
                    if ( error ) reject( error );
                    else resolve( newTxId );
                });
            });
        });

        return this.raceToSuccess( insightPromises, this.timeoutMs );
    }

    private btcPerKbToSatoshisPerByte( btcPerKb ): number {
        return Bitcore.Unit.fromBTC( btcPerKb ).toSatoshis() / 1000;
    }

    // Takes an array of Promises and returns a master Promise.
    // As soon as one promise resolves, resolve the master promise with that resolved value.
    // If all the promises reject, reject the master promise with an array of rejected values.
    // This is essentially an inverted Promise.all
    // timeoutMs is optional. If not given, no timer is set.
    private raceToSuccess( promises, timeoutMs? ): Promise<any> {
        if ( timeoutMs === undefined ) timeoutMs = this.timeoutMs;
        return new Promise( (resolve, reject) => {
            Promise.all( promises.map( p => {
                // If a request fails, count that as a resolution so it will keep
                // waiting for other possible successes. If a request succeeds,
                // treat it as a rejection so Promise.all immediately bails out.
                return p.then(
                    val => Promise.reject( val ),
                    err => Promise.resolve( err )
                );
            })).then(
                // If '.all' resolved, we've just got an array of errors.
                errors => reject( errors ),
                // If '.all' rejected, we've got the result we wanted.
                val => resolve( val )
            );

            if ( timeoutMs ) {
                setTimeout( () => reject( 'Timed out.' ), timeoutMs );
            }
        })
    }

    // Fetches and returns a Promise, but rejects on status != 200.
    // JSON-decodes a good result, and text-decodes a bad result
    private fetchJSON( url ): Promise<any> {
        return new Promise( (resolve, reject) => {
            fetch( url )
            .then( result => {
                if ( result.status === 200 ) {
                    result.json().then( data => resolve(data), err => reject(err) );
                } else {
                    result.text().then( data => reject(data), err => reject(err) );
                }
            })
            .catch( err => {
                reject( err );
            })
        })
    }
}
