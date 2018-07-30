import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material';
import { BasicDialog } from '../../dialogs/basic-dialog/basic-dialog.component';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { BlockchainType } from '../../models/blockchain-types';
import * as CashAddr from 'bchaddrjs';
import * as Bitcore from 'bitcore-lib';
import * as BitcoreCash from 'bitcore-lib-cash';

@Component({
    selector: 'app-check-balance',
    templateUrl: './check-balance.component.html',
    styleUrls: ['./check-balance.component.scss']
})
export class CheckBalanceComponent implements OnInit {

    constructor( private blockchainService: BlockchainService, private dialog: MatDialog ) { }

    public checkBalance( p2shAddress: string ) {
        try {
            // Find the address' blockchain and network
            let chain: BlockchainType;
            let addr: Bitcore.Address | BitcoreCash.Address;
            if ( Bitcore.Address.isValid(p2shAddress) ) {
                addr = Bitcore.Address.fromString( p2shAddress );
                chain = addr.network.name === 'livenet' ? BlockchainType.BTC : BlockchainType.tBTC;
            } else if ( BitcoreCash.Address.isValid(p2shAddress) ) {
                addr = BitcoreCash.Address.fromString( p2shAddress );
                chain = addr.network.name === 'livenet' ? BlockchainType.BCH : BlockchainType.tBCH;
            } else {
                throw 'Invalid address.';
            }

            // Set the correct blockchain/network
            this.blockchainService.setBlockchainType( chain );
            let bitcoreLib = this.blockchainService.getBlockchainType().bitcoreLib;

            // Sum all UTXOs for the address
            this.blockchainService.getUTXOs( p2shAddress )
            .then( (utxos: any[]) => {
                // Add the available satoshis from all UTXOs
                let totalSatoshis = utxos.reduce( (total, utxo) => total + utxo.satoshis, 0 );
                this.dialog.open( BasicDialog, { data: {
                    title: 'Balance of time-locked address',
                    body: bitcoreLib.Unit.fromSatoshis(totalSatoshis).toBTC() + ' ' + this.blockchainService.getBlockchainType().shortName
                }});
            })
            .catch( err => this.showError(err) );

        } catch ( e ) {
            this.showError( e );
        }
    }

    public showError( e: Error | string ) {
        if ( typeof e === 'string' ) e = new Error( e );
        this.dialog.open( BasicDialog, { data: {
            title: 'Error',
            body: e.message
        }});
    }

    ngOnInit() {
    }

}
