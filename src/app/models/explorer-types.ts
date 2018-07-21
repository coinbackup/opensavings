import { NetworkService } from '../services/network/network.service';
import { BlockchainForks } from './blockchain-forks';
import { AppError } from './error-types';
import * as CashAddr from 'bchaddrjs';
import * as Bitcore from 'bitcore-lib';
import * as BitcoreCash from 'bitcore-lib-cash';

// Block explorer APIs.
// You can use this file to easily configure a new API enpoint, and add it to the list of
// available block explorers in the blockchain-types file.

export interface IExplorer {
    getUTXOs( address: string ): Promise<any>;
    getFeeRates(): Promise<any>;
    broadcastTx( serializedTx: string ): Promise<any>;

    url: string;

    fork: string;
    bitcoreLib: Bitcore|BitcoreCash;
}


export class InsightExplorer implements IExplorer {

    public fork: string;
    public bitcoreLib: Bitcore|BitcoreCash;
    
    // Some BCH explorers only accept legacy address formats in API calls. We'll have to convert to legacy format for these.
    constructor( public url: string, public convertCashAddrToLegacy: boolean = false ) {}


    // Get unspent transaction outputs for an address.
    public getUTXOs( address: string ): Promise<any> {
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
    public getFeeRates(): Promise<any> {
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


    public broadcastTx( serializedTx: string ): Promise<any> {
        return NetworkService.instance.postJSON( this.url + '/api/tx/send', { rawtx: serializedTx } )
        // the format of the response can vary between different insight servers
        .then( response => response.txid.result || response.txid );
    }


    private btcPerKbToSatoshisPerByte( btcPerKb: number ): number {
        return this.bitcoreLib.Unit.fromBTC( btcPerKb ).toSatoshis() / 1000;
    }
}
