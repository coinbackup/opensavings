import * as Bitcore from 'bitcore-lib';
import * as BitcoreCash from 'bitcore-lib-cash';

// Define a format for recording differences between blockchain explorers.
export class BlockchainExplorer {
    // Different kinds of APIs return data in different formats
    public static API_TYPES = {
        INSIGHT: 'INSIGHT'
    };

    // Some APIs only accept bitcoin cash API queries in the legacy format
    public static ADDR_FORMATS = {
        LEGACY: 'LEGACY',
        CASH_ADDR: 'CASH_ADDR'
    };

    constructor(
        public url: string,
        public addrFormat: string = BlockchainExplorer.ADDR_FORMATS.LEGACY,
        public type: string = BlockchainExplorer.API_TYPES.INSIGHT,
    ) {}
}

// Define a structure for storing differences between different blockchains
export class BlockchainType {

    public static FORKS = {
        BTC: 'BTC',
        BCH: 'BCH'
    };

    public static BTC: BlockchainType = new BlockchainType(
        'BTC',
        'Bitcoin',
        BlockchainType.FORKS.BTC,
        Bitcore,
        Bitcore.Networks.livenet,
        Bitcore.crypto.Signature.SIGHASH_ALL,
        [
            new BlockchainExplorer( 'https://insight.bitpay.com/api' ),
            new BlockchainExplorer( 'https://btc.blockdozer.com/api' ),
            new BlockchainExplorer( 'https://blockexplorer.com/api' ),
            new BlockchainExplorer( 'https://www.localbitcoinschain.com/api' ),
            new BlockchainExplorer( 'https://insight.bitcoin.com/api' )
        ]
    );

    public static tBTC: BlockchainType = new BlockchainType(
        'tBTC',
        'Bitcoin (testnet)',
        BlockchainType.FORKS.BTC,
        Bitcore,
        Bitcore.Networks.testnet,
        Bitcore.crypto.Signature.SIGHASH_ALL,
        [
            new BlockchainExplorer( 'https://test-insight.bitpay.com/api' ),
            new BlockchainExplorer( 'https://tbtc.blockdozer.com/api' ),
            new BlockchainExplorer( 'https://testnet.blockexplorer.com/api' )
        ]
    );

    public static BCH: BlockchainType = new BlockchainType(
        'BCH',
        'Bitcoin Cash',
        BlockchainType.FORKS.BCH,
        BitcoreCash,
        BitcoreCash.Networks.livenet,
        BitcoreCash.crypto.Signature.SIGHASH_ALL | BitcoreCash.crypto.Signature.SIGHASH_FORKID,
        [
            new BlockchainExplorer( 'https://bch-insight.bitpay.com/api',        BlockchainExplorer.ADDR_FORMATS.CASH_ADDR ), // good (accepts invalid txs)
            new BlockchainExplorer( 'https://bch.blockdozer.com/api',            BlockchainExplorer.ADDR_FORMATS.CASH_ADDR ), // good (except for broadcasting tx)
            //new BlockchainExplorer( 'https://bitcoincash.blockexplorer.com/api', BlockchainExplorer.ADDR_FORMATS.CASH_ADDR ), // bad (ECONNREFUSED)
            new BlockchainExplorer( 'https://cashexplorer.bitcoin.com/api',      BlockchainExplorer.ADDR_FORMATS.LEGACY ) // good (accepts invalid txs)
        ]
    );

    public static tBCH: BlockchainType = new BlockchainType(
        'tBCH',
        'Bitcoin Cash (testnet)',
        BlockchainType.FORKS.BCH,
        BitcoreCash,
        BitcoreCash.Networks.testnet,
        BitcoreCash.crypto.Signature.SIGHASH_ALL | BitcoreCash.crypto.Signature.SIGHASH_FORKID,
        [
            new BlockchainExplorer( 'https://test-bch-insight.bitpay.com/api', BlockchainExplorer.ADDR_FORMATS.CASH_ADDR ),
            new BlockchainExplorer( 'https://tbch.blockdozer.com/api', BlockchainExplorer.ADDR_FORMATS.CASH_ADDR )
            // There's probably a test-bch blockexplorer site, but I coudln't find it...
        ]
    );

    public static allTypes: BlockchainType[] = [
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
        public explorers: BlockchainExplorer[]
    ) {}
    
}