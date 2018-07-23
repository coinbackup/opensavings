import { NetworkService } from '../services/network/network.service';
import { BlockchainForks } from './blockchain-forks';
import { AppError } from './error-types';
import * as CashAddr from 'bchaddrjs';
import * as Bitcore from 'bitcore-lib';
import * as BitcoreCash from 'bitcore-lib-cash';
import { FeeRates, UTXO } from './api-responses';

// Block explorer APIs.
// You can use this file to easily configure a new API enpoint, and add it to the list of
// available block explorers in the blockchain-types file.

export interface IExplorer {
    getUSDRate?(): Promise<number>;
    getUTXOs?( address: string ): Promise<UTXO[]>;
    getFeeRates?(): Promise<FeeRates>;
    broadcastTx?( serializedTx: string ): Promise<string>;

    url: string;
    fork: string;
    bitcoreLib: Bitcore|BitcoreCash;
    
    canGetUSDRate: boolean;
    canGetUTXOs: boolean;
    canGetFeeRates: boolean;
    canBroadcast: boolean;
}


export abstract class Explorer {
    public fork: string;
    public bitcoreLib: Bitcore|BitcoreCash;
    
    // Not all APIs have all features. Provide a way to keep track of how we can use each kind of API.
    constructor(
        public url: string,
        public canGetUSDRate: boolean,
        public canGetUTXOs: boolean,
        public canGetFeeRates: boolean,
        public canBroadcast: boolean
    ) {}
}


export class InsightExplorer extends Explorer implements IExplorer {
    
    // Some BCH explorers only accept legacy address formats in API calls. We'll have to convert to legacy format for these.
    // Some BCH instances of Insight return the BTC USD rate. Account for those as well.
    constructor( public url: string, public convertCashAddrToLegacy: boolean = false, USDRateWorksProperly: boolean = true ) {
        super( url, USDRateWorksProperly, true, true, true );
    }

    public getUSDRate(): Promise<number> {
        // A response from the server might look like: {"status":200,"data":{"kraken":788.4}}
        return NetworkService.instance.fetchJSON( this.url + '/api/currency' )
        .then( response => response.data[ Object.keys(response.data)[0] ] );
    }
    
    // Get unspent transaction outputs for an address.
    public getUTXOs( address: string ): Promise<UTXO[]> {
        if ( this.convertCashAddrToLegacy ) {
            address = CashAddr.toLegacyAddress( address );
        }
        return NetworkService.instance.fetchJSON( this.url + '/api/addr/' + address + '/utxo' )
        .then( utxos => {
            // For BCH, some servers don't return addresses in cashAddr format, and this breaks the code. The formatting needs to be fixed.
            if ( this.fork === BlockchainForks.BCH ) {
                utxos.forEach( utxo => utxo.address = CashAddr.toCashAddress(utxo.address) );
            }
            return utxos;
        });
    }


    // Find the estimated fees in satoshis/byte to get the transaction included in:
    // The next 2 blocks, the next 4 blocks, or the next 8 blocks
    public getFeeRates(): Promise<FeeRates> {
        // Get all three fee estmations from the same service.
        return Promise.all([
            NetworkService.instance.fetchJSON( this.url + '/api/utils/estimatefee?nbBlocks=2' ),
            NetworkService.instance.fetchJSON( this.url + '/api/utils/estimatefee?nbBlocks=4' ),
            NetworkService.instance.fetchJSON( this.url + '/api/utils/estimatefee?nbBlocks=8' )
        ])
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
        });
    }


    public broadcastTx( serializedTx: string ): Promise<string> {
        return NetworkService.instance.postJSON( this.url + '/api/tx/send', { rawtx: serializedTx } )
        // the format of the response can vary between different insight servers
        .then( response => response.txid.result || response.txid );
    }


    private btcPerKbToSatoshisPerByte( btcPerKb: number ): number {
        return this.bitcoreLib.Unit.fromBTC( btcPerKb ).toSatoshis() / 1000;
    }
}


export class BTCDotComExplorer extends Explorer implements IExplorer {

    // @@ in responses, what should I do if response.data.total_count > response.data.pagesize?
    // total_count = number of entries, page = current page, pagesize = entries per page
    
    constructor( public url: string ) {
        super( url, false, true, false, false );
    }

    // Get unspent transaction outputs for an address.
    public getUTXOs( address: string ): Promise<any> {
        // The BCH version only accepts addresses in legacy format
        if ( this.fork === BlockchainForks.BCH ) {
            address = CashAddr.toLegacyAddress( address );
        }
        return NetworkService.instance.fetchJSON( this.url + '/v3/address/' + address + '/unspent' )
        .then( response => {
            this.checkForError( response );
            // Convert the response to a common format that bitcore will understand
            return response.data.list.map( utxo => {
                return {
                    amount: this.bitcoreLib.Unit.fromSatoshis( utxo.value ).toBTC,
                    satoshis: utxo.value,
                    txid: utxo.tx_hash,
                    confirmations: utxo.confirmations,
                    vout: utxo.tx_output_n
                };
            });
        });
    }

    // With this API, if the request was malformed, it returns 200 and gives an error message in the JSON response.
    private checkForError( serverResponse ) {
        if ( serverResponse.err_no !== 0 ) {
            throw new AppError( AppError.TYPES.SERVER, serverResponse.err_msg );
        }
    }
}


export class CoinMarketCapExplorer extends Explorer implements IExplorer {
    constructor( public url: string ) {
        super( url, true, false, false, false );
    }

    public getUSDRate(): Promise<number> {
        let coinID: number = this.fork === BlockchainForks.BTC ? 1 : 1831;
        return NetworkService.instance.fetchJSON( this.url + '/v2/ticker/' + coinID + '/' )
        .then( response => response.data.quotes.USD.price );
    }
}
