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
        // remove any prefix like 'bitcoincash:' from the address
        p2shAddress = p2shAddress.replace( /^.*:/, '' );
        
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

            this.blockchainService.getBalance( p2shAddress )
            .catch( err => {
                // We couldn't directly get the number of satoshis for some reason. Try to get the
                // balance by summing up UTXOs
                return this.blockchainService.getUTXOs( p2shAddress )
                .then( (utxos: any[]) => {
                    // Add the available satoshis from all UTXOs
                    return utxos.reduce( (total, utxo) => total + utxo.satoshis, 0 );
                });
            })
            .then( totalSatoshis => {
                totalCoins = bitcoreLib.Unit.fromSatoshis(totalSatoshis).toBTC();
                this.balanceInfo.totalCoinsText = totalCoins + ' ' + this.blockchainService.getBlockchainType().shortName;
                // If we can't get the USD rate, don't sweat it. Set the resolved value to 'null' and the UI won't show USD.
                return this.blockchainService.getUSDRate().catch( err => null );
            })
            .then( (USDPerCoin: number) => {
                if ( USDPerCoin != null ) {
                    let usd = USDPerCoin * totalCoins;
                    this.balanceInfo.totalUSDText = usd < 0.01 ? 'less than $0.01 USD' : '$' + usd.toFixed(2) + ' USD';
                } else {
                    this.balanceInfo.totalUSDText = null;
                }
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
