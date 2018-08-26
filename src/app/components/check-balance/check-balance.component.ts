import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material';
import { BasicDialog } from '../../dialogs/basic-dialog/basic-dialog.component';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { BlockchainType } from '../../models/blockchain-types';
import { QrScannerComponent } from '../qr-scanner/qr-scanner.component';
import { SmoothScroll } from '../../services/smooth-scroll/smooth-scroll.service';
import * as Bitcore from 'bitcore-lib';
import * as BitcoreCash from 'bitcore-lib-cash';

@Component({
    selector: 'app-check-balance',
    templateUrl: './check-balance.component.html',
    styleUrls: ['./check-balance.component.scss']
})
export class CheckBalanceComponent implements OnInit {

    buttonDisabled: boolean = false;
    lockedAddress: string = '';
    qrScanner = QrScannerComponent.instance;

    balanceInfo = {
        totalCoinsText: undefined,
        totalUSDText: undefined
    };

    constructor( private blockchainService: BlockchainService, private dialog: MatDialog, private smoothScroll:SmoothScroll ) {
        QrScannerComponent.onQrScanSuccess = decoded => this.lockedAddress = decoded;
        QrScannerComponent.onQrScanFailure = message => this.showError( message );
    }

    public checkBalance( p2shAddress: string ) {
        this.buttonDisabled = true;
        
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
            let totalCoins = 0;

            // Sum all UTXOs for the address
            this.blockchainService.getUTXOs( p2shAddress )
            .then( (utxos: any[]) => {
                // Add the available satoshis from all UTXOs
                let totalSatoshis = utxos.reduce( (total, utxo) => total + utxo.satoshis, 0 );
                totalCoins = bitcoreLib.Unit.fromSatoshis(totalSatoshis).toBTC();
                this.balanceInfo.totalCoinsText = totalCoins + ' ' + this.blockchainService.getBlockchainType().shortName;
                return this.blockchainService.getUSDRate()
            })
            .then( (USDPerCoin: number) => {
                this.balanceInfo.totalUSDText = '$' + ( USDPerCoin * totalCoins ).toFixed( 2 );
                setTimeout( () => {
                    this.smoothScroll.to( document.getElementById('success') );
                }, 100 );
            })
            .catch( err => this.showError(err) )
            ['finally']( () => this.buttonDisabled = false );

        } catch ( e ) {
            this.showError( e );
            this.buttonDisabled = false;
        }
    }

    public showError( e: Error | string ) {
        if ( typeof e === 'string' ) e = new Error( e );
        this.dialog.open( BasicDialog, { data: {
            title: 'Error',
            icon: './assets/img/icons/x.svg',
            body: e.message
        }});
    }

    ngOnInit() {
    }

}
