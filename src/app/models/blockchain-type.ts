import * as Bitcore from 'bitcore-lib';

export class BlockchainType {

    constructor( public networkType: Bitcore.Network, public insightURLs: string[] ) {
    }

}
