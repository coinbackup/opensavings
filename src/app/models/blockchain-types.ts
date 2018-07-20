import * as Bitcore from 'bitcore-lib';
import * as BitcoreCash from 'bitcore-lib-cash';
import * as CashAddr from 'bchaddrjs';

export class BlockchainType {
    constructor(
        public shortName: string,
        public longName: string,
        public bitcoreLib: any,
        public networkType: Bitcore.Network|BitcoreCash.Network,
        public sigType: any,
        public fixAddress: Function,
        public insightURLs: string[]
    ) {}
}

export class BlockchainTypes {
    
    // Define differences between different blockchains

    // No conversion needed
    public static BTCAddressFixer = function( address: string ): string {
        return address;
    }

    // Convert BTC-style addresses to CashAddr format
    public static BCHAddressFixer = function( address: string): string {
        // .toCashAddress will convert legacy address format to cashaddr, and leave
        // addresses that are already in cashaddr format unchanged
        return CashAddr.toCashAddress( address );
    }


    public static BTC: BlockchainType = new BlockchainType(
        'BTC',
        'Bitcoin',
        Bitcore,
        Bitcore.Networks.livenet,
        Bitcore.crypto.Signature.SIGHASH_ALL,
        BlockchainTypes.BTCAddressFixer,
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
        BlockchainTypes.BTCAddressFixer,
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
        BlockchainTypes.BCHAddressFixer,
        [
            'https://bch-insight.bitpay.com',
            //'https://bch.blockdozer.com',
            //'https://bitcoincash.blockexplorer.com'
        ]
    );

    public static tBCH: BlockchainType = new BlockchainType(
        'tBCH',
        'Bitcoin Cash (testnet)',
        BitcoreCash,
        BitcoreCash.Networks.testnet,
        BitcoreCash.crypto.Signature.SIGHASH_ALL | BitcoreCash.crypto.Signature.SIGHASH_FORKID,
        BlockchainTypes.BCHAddressFixer,
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