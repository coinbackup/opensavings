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
    getBalance?( address: string ): Promise<number>; // number of satoshis
    broadcastTx?( serializedTx: string ): Promise<string>;

    url: string;
    fork: string;
    bitcoreLib: Bitcore|BitcoreCash;
    networkType: Bitcore.Network|BitcoreCash.Network;
    
    canGetUSDRate: boolean;
    canGetUTXOs: boolean;
    canGetFeeRates: boolean;
    canBroadcast: boolean;
    canGetBalance: boolean;
}


export abstract class Explorer {
    public fork: string;
    public bitcoreLib: Bitcore|BitcoreCash;
    public networkType: Bitcore.Network|BitcoreCash.Network;
    
    // Not all APIs have all features. Provide a way to keep track of how we can use each kind of API.
    constructor(
        public url: string,
        public canGetUSDRate: boolean,
        public canGetUTXOs: boolean,
        public canGetFeeRates: boolean,
        public canBroadcast: boolean,
        public canGetBalance: boolean
    ) {}
}

export class BitcoreExplorer extends Explorer implements IExplorer {

    constructor( public url: string, getBalanceWorks: boolean = true, getUtxosWorks: boolean = true ) {
        super( url, false, getUtxosWorks, true, true, getBalanceWorks );
    }

    // Get balance in satoshis, using only confirmed txs
    public getBalance( address: string ): Promise<number> {
        return NetworkService.instance.fetchJSON( this.url + '/address/' + address + '/balance' )
        .then( response => response.confirmed );
    }

    // Get unspent transaction outputs for an address.
    public getUTXOs( address: string ): Promise<UTXO[]> {
        return NetworkService.instance.fetchJSON( this.url + '/address/' + address + '/?unspent=true' )
        // convert the transactions into a format bitcore understands
        .then( utxos => utxos.map( utxo => {
            return {
                amount: this.bitcoreLib.Unit.fromSatoshis( utxo.value ).toBTC(),
                satoshis: utxo.value,
                txid: utxo.mintTxid,
                confirmations: utxo.confirmations,
                vout: utxo.mintIndex,
                script: utxo.script
            };
        })).then( r => {
            console.log( r );
            return r;
        });
    }

    // Find the estimated fees in satoshis/byte to get the transaction included in:
    // The next 2 blocks, the next 4 blocks, or the next 8 blocks
    public getFeeRates(): Promise<FeeRates> {
        // Get all three fee estmations from the same service.
        return Promise.all([
            NetworkService.instance.fetchJSON( this.url + '/fee/2' ),
            NetworkService.instance.fetchJSON( this.url + '/fee/4' ),
            NetworkService.instance.fetchJSON( this.url + '/fee/8' )
        ])
        .then( fees => {
            // Convert the somewhat odd response format into an object with high/medium/low properties.
            // Also convert the returned BTC/kb units into satoshis/byte.
            const convertedFees = fees.map( fee => this.btcPerKbToSatoshisPerByte(fee.feerate) );
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
        return NetworkService.instance.postJSON( this.url + '/tx/send', { rawtx: serializedTx } )
        // the format of the response can vary between different servers
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
        super( url, false, true, false, false, false );
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
            if ( response.data.list == null ) {
                response.data.list = [];
            }
            return response.data.list.map( utxo => {
                return {
                    amount: this.bitcoreLib.Unit.fromSatoshis( utxo.value ).toBTC(),
                    satoshis: utxo.value,
                    txid: utxo.tx_hash,
                    confirmations: utxo.confirmations,
                    vout: utxo.tx_output_n
                    // @@?? script???
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


// only works with BTC
export class BitcoinFeesExplorer extends Explorer implements IExplorer {
    constructor( public url: string ) {
        super( url, false, false, true, false, false );
    }

    public getFeeRates(): Promise<FeeRates> {
        return NetworkService.instance.fetchJSON( this.url + '/api/v1/fees/recommended' )
        .then( response => {
            return {
                low: response.hourFee,
                medium: response.halfHourFee,
                high: response.fastestFee
            };
        });
    }
}


// this explorer only works with BTC mainnet or testnet
export class ChainSoExplorer extends Explorer implements IExplorer {
    constructor( public url: string ) {
        super( url, true, true, false, true, false );
    }

    private getNetworkSymbol(): string {
        let symbol = this.networkType === Bitcore.Networks.livenet ? 'BTC' :
            this.networkType === Bitcore.Networks.testnet ? 'BTCTEST' :
            undefined;
        if ( symbol === undefined ) {
            throw 'Using unsupported network for ChainSo explorer';
        }
        return symbol;
    }

    public getUSDRate(): Promise<number> {
        // the api call to get BTCTEST price does not return anything useful. Use BTC always
        return NetworkService.instance.fetchJSON( this.url + `/api/v2/get_price/BTC/USD` )
        .then( response => parseFloat(response.data.prices[0].price) );
    }

    public getUTXOs( address: string ): Promise<UTXO[]> {
        let networkSymbol = this.getNetworkSymbol();
        return NetworkService.instance.fetchJSON( this.url + `/api/v2/get_tx_unspent/${networkSymbol}/${address}` )
        .then( response => {
            // Convert the response to a bitcore-friendly format
            return response.data.txs.map( utxo => {
                let btcValue = parseFloat( utxo.value );
                return {
                    amount: parseFloat( utxo.value ),
                    satoshis: this.bitcoreLib.Unit.fromBTC( btcValue ).toSatoshis(),
                    txid: utxo.txid,
                    confirmations: utxo.confirmations,
                    vout: utxo.output_no,
                    script: utxo.script_hex
                };
            });
        });
    }

    public broadcastTx( serializedTx: string ): Promise<string> {
        let networkSymbol = this.getNetworkSymbol();
        return NetworkService.instance.postJSON( this.url + `/api/v2/send_tx/${networkSymbol}`, { tx_hex: serializedTx } )
        .then( response => response.txid || response.data.txid );
    }
}


// this explorer only works with BCH mainnet or testnet
export class BitcoinDotComExplorer extends Explorer implements IExplorer {
    constructor( public url: string ) {
        super( url, false, true, false, true, false );
    }

    public getUTXOs( address: string ): Promise<UTXO[]> {
        return NetworkService.instance.fetchJSON( this.url + `/v2/address/utxo/${address}` )
        .then( response => {
            // No need to convert; the format returned is exactly as bitcore expects
            return response.utxos;
        });
    }

    public broadcastTx( serializedTx: string ): Promise<string> {
        return NetworkService.instance.postJSON( this.url + `/v2/rawtransactions/sendRawTransaction`, {hexes: [serializedTx]} )
        .then( response => response[0] );
    }
}
