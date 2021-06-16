import {
    BitcoinDotComExplorer,
    BitcoinFeesExplorer,
    BitcoreExplorer,
    BTCDotComExplorer,
    ChainSoExplorer,
    IExplorer
} from './explorer-types';
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
        ( txId ) => 'https://blockchair.com/bitcoin/transaction/' + txId,
        [
            new BitcoreExplorer( 'https://api.bitcore.io/api/BTC/mainnet' ),
            new BTCDotComExplorer( 'https://chain.api.btc.com' ),
            new BitcoinFeesExplorer( 'https://bitcoinfees.earn.com' ),
            new ChainSoExplorer( 'https://chain.so' )
        ],
        'https://blockchair.com/broadcast#bitcoin'
    );

    public static readonly tBTC: BlockchainType = new BlockchainType(
        'tBTC',
        'Bitcoin (testnet)',
        BlockchainForks.BTC,
        Bitcore,
        Bitcore.Networks.testnet,
        Bitcore.crypto.Signature.SIGHASH_ALL,
        ( txId ) => 'https://tbtc.bitaps.com/' + txId,
        [
            new BitcoreExplorer( 'https://api.bitcore.io/api/BTC/testnet' ),
            new ChainSoExplorer( 'https://chain.so' )
        ],
        'https://live.blockcypher.com/btc-testnet/pushtx/'
    );

    public static readonly BCH: BlockchainType = new BlockchainType(
        'BCH',
        'Bitcoin Cash',
        BlockchainForks.BCH,
        BitcoreCash,
        BitcoreCash.Networks.livenet,
        BitcoreCash.crypto.Signature.SIGHASH_ALL | BitcoreCash.crypto.Signature.SIGHASH_FORKID,
        ( txId ) => 'https://blockchair.com/bitcoin-cash/transaction/' + txId,
        [
            new BitcoreExplorer( 'https://api.bitcore.io/api/BCH/mainnet' ),
            new BTCDotComExplorer( 'https://bch-chain.api.btc.com' ),
            new BitcoinDotComExplorer( 'https://rest.bitcoin.com' ),
            new BitcoinDotComExplorer( 'https://rest.bch.actorforth.org' )
        ],
        'https://blockchair.com/broadcast#bitcoin-cash'
    );

    public static readonly tBCH: BlockchainType = new BlockchainType(
        'tBCH',
        'Bitcoin Cash (testnet)',
        BlockchainForks.BCH,
        BitcoreCash,
        BitcoreCash.Networks.testnet,
        BitcoreCash.crypto.Signature.SIGHASH_ALL | BitcoreCash.crypto.Signature.SIGHASH_FORKID,
        ( txId ) => 'https://tbch.blockdozer.com/tx/' + txId,
        [
            new BitcoreExplorer( 'https://api.bitcore.io/api/BCH/testnet', false, false ),
            new BitcoinDotComExplorer( 'https://trest.bitcoin.com' )
        ],
        'https://trest.bitcoin.com/#/rawtransactions/sendRawTransactionSingle'
    );

    public static readonly allTypes: BlockchainType[] = [
        BlockchainType.BCH,
        BlockchainType.BTC,
        BlockchainType.tBCH,
        BlockchainType.tBTC
    ];


    constructor(
        public shortName: string,
        public longName: string,
        public fork: string,
        public bitcoreLib: any,
        public networkType: Bitcore.Network|BitcoreCash.Network,
        public sigType: any,
        public getTxExplorerLink: Function,
        public explorers: IExplorer[],
        /** A URL for the user to visit and manually paste in a serialized transaction, in order to broadcast it */
        public broadcastFallbackUrl: string
    ) {
        // Give a reference to some important things in each of the explorers
        this.explorers.forEach( explorer => {
            explorer.bitcoreLib = this.bitcoreLib;
            explorer.fork = this.fork;
            explorer.networkType = this.networkType;
        });
    }
    
}