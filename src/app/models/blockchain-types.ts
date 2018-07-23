import { IExplorer, InsightExplorer, BTCDotComExplorer, CoinMarketCapExplorer } from './explorer-types';
import { BlockchainForks } from './blockchain-forks';
import * as Bitcore from 'bitcore-lib';
import * as BitcoreCash from 'bitcore-lib-cash';

// Define a structure for storing differences between different blockchains
export class BlockchainType {

    public static readonly BTC: BlockchainType = new BlockchainType(
        'BTC',
        'Bitcoin',
        BlockchainForks.BTC,
        Bitcore,
        Bitcore.Networks.livenet,
        Bitcore.crypto.Signature.SIGHASH_ALL,
        [
            new InsightExplorer( 'https://insight.bitpay.com' ),
            new InsightExplorer( 'https://btc.blockdozer.com' ),
            new InsightExplorer( 'https://blockexplorer.com' ),
            new InsightExplorer( 'https://insight.bitcoin.com' ),
            new InsightExplorer( 'https://www.localbitcoinschain.com' ),
            new BTCDotComExplorer( 'https://chain.api.btc.com' ),
            new CoinMarketCapExplorer( 'https://api.coinmarketcap.com' )
        ]
    );

    public static readonly tBTC: BlockchainType = new BlockchainType(
        'tBTC',
        'Bitcoin (testnet)',
        BlockchainForks.BTC,
        Bitcore,
        Bitcore.Networks.testnet,
        Bitcore.crypto.Signature.SIGHASH_ALL,
        [
            new InsightExplorer( 'https://test-insight.bitpay.com' ),
            new InsightExplorer( 'https://tbtc.blockdozer.com' ),
            new InsightExplorer( 'https://testnet.blockexplorer.com' ),
            new CoinMarketCapExplorer( 'https://api.coinmarketcap.com' )
        ]
    );

    public static readonly BCH: BlockchainType = new BlockchainType(
        'BCH',
        'Bitcoin Cash',
        BlockchainForks.BCH,
        BitcoreCash,
        BitcoreCash.Networks.livenet,
        BitcoreCash.crypto.Signature.SIGHASH_ALL | BitcoreCash.crypto.Signature.SIGHASH_FORKID,
        [
            new InsightExplorer( 'https://bch-insight.bitpay.com' ),            // good (except it accepts invalid txs)
            new InsightExplorer( 'https://bch.blockdozer.com' ),                // good (except I can't use it to broadcast txs)
            //new InsightExplorer( 'https://bitcoincash.blockexplorer.com', false, false ),     // bad (ECONNREFUSED)
            new InsightExplorer( 'https://cashexplorer.bitcoin.com', true, false ),    // good (except it accepts invalid txs)
            new BTCDotComExplorer( 'https://bch-chain.api.btc.com' ),
            new CoinMarketCapExplorer( 'https://api.coinmarketcap.com' ),
        ]
    );

    public static readonly tBCH: BlockchainType = new BlockchainType(
        'tBCH',
        'Bitcoin Cash (testnet)',
        BlockchainForks.BCH,
        BitcoreCash,
        BitcoreCash.Networks.testnet,
        BitcoreCash.crypto.Signature.SIGHASH_ALL | BitcoreCash.crypto.Signature.SIGHASH_FORKID,
        [
            new InsightExplorer( 'https://test-bch-insight.bitpay.com', false, false ),
            new InsightExplorer( 'https://tbch.blockdozer.com' ),
            // There's probably a test-bch blockexplorer site, but I couldn't find it...
            new CoinMarketCapExplorer( 'https://api.coinmarketcap.com' )
        ]
    );

    public static readonly allTypes: BlockchainType[] = [
        BlockchainType.BTC,
        BlockchainType.tBTC,
        BlockchainType.BCH,
        BlockchainType.tBCH
    ];


    constructor(
        public shortName: string,
        public longName: string,
        public fork: string,
        public bitcoreLib: any,
        public networkType: Bitcore.Network|BitcoreCash.Network,
        public sigType: any,
        public explorers: IExplorer[]
    ) {
        // Give a reference to some important things in each of the explorers
        this.explorers.forEach( explorer => {
            explorer.bitcoreLib = this.bitcoreLib;
            explorer.fork = this.fork;
        });
    }
    
}