import * as Bitcore from 'bitcore-lib';
import * as BitcoreCash from 'bitcore-lib-cash';

export class BlockchainType {
    constructor(
        public shortName: string,
        public longName: string,
        public bitcoreLib: any,
        public networkType: Bitcore.Network|BitcoreCash.Network,
        public sigType: any,
        public insightURLs: string[]
    ) {}
}

export class BlockchainTypes {
    
    // Define differences between different blockchains

    public static BTC: BlockchainType = new BlockchainType(
        'BTC',
        'Bitcoin',
        Bitcore,
        Bitcore.Networks.livenet,
        Bitcore.crypto.Signature.SIGHASH_ALL,
        [
            'https://insight.bitpay.com',
            //'https://btc.blockdozer.com',
            'https://blockexplorer.com',
            'https://www.localbitcoinschain.com'
        ]
    );

    public static tBTC: BlockchainType = new BlockchainType(
        'tBTC',
        'Bitcoin (testnet)',
        Bitcore,
        Bitcore.Networks.testnet,
        Bitcore.crypto.Signature.SIGHASH_ALL,
        [
            'https://test-insight.bitpay.com',
            //'https://tbtc.blockdozer.com',
            'https://testnet.blockexplorer.com'
        ]
    );

    public static BCH: BlockchainType = new BlockchainType(
        'BCH',
        'Bitcoin Cash',
        BitcoreCash,
        BitcoreCash.Networks.livenet,
        BitcoreCash.crypto.Signature.SIGHASH_ALL | BitcoreCash.crypto.Signature.SIGHASH_FORKID,
        [
            'https://bch-insight.bitpay.com',
            //'https://blockdozer.com',
            'https://bitcoincash.blockexplorer.com'
        ]
    );

    public static tBCH: BlockchainType = new BlockchainType(
        'tBCH',
        'Bitcoin Cash (testnet)',
        BitcoreCash,
        BitcoreCash.Networks.testnet,
        BitcoreCash.crypto.Signature.SIGHASH_ALL | BitcoreCash.crypto.Signature.SIGHASH_FORKID,
        [
            'https://test-bch-insight.bitpay.com',
            //'https://tbch.blockdozer.com'
            // There's probably a test-bch blockexplorer site, but I coudln't find it...
        ]
    );

    public static allTypes: BlockchainType[] = [
        BlockchainTypes.BTC,
        BlockchainTypes.tBTC,
        BlockchainTypes.BCH,
        BlockchainTypes.tBCH
    ];

    constructor() {}
}