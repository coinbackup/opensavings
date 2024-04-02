// Unspent transaction output
export class UTXO {
    // Amount transferred in the output, in BTC/BCH
    public amount: number;
    
    // Amount transferred in the output, in Satoshis
    public satoshis: number;

    // ID of the transaction which contains this output
    public txid: string;

    // number of confirmations on the transaction which contains this output
    public confirmations: number

    // The index number of this output in the containing transaction (w.r.t. all outputs in the tx, zero-indexed)
    public vout: number;

    public script: string;
}

// Current transaction fees in Satoshis/byte
export class FeeRates {
    // Fee rate for getting your tx confirmed in the next ~2 blocks
    public high: number;

    // Fee rate for confirmation in the next ~4 blocks
    public medium: number;

    // Fee rate for confirmation in the next ~8 blocks
    public low: number;
}