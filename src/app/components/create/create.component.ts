import { Component, OnInit, Input } from '@angular/core';
import { MatDialog } from '@angular/material';
import { TimeLockService } from '../../services/time-lock/time-lock.service';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { BlockchainType } from '../../models/blockchain-types';
import { TimeLockTypes } from '../../models/time-lock-types';
import { ConstantsService } from '../../services/constants/constants.service';
import { BasicDialog } from '../../dialogs/basic-dialog/basic-dialog.component';

@Component({
    selector: 'app-create',
    templateUrl: './create.component.html',
    styleUrls: ['./create.component.scss']
})
export class CreateComponent implements OnInit {

    public lockDate: Date;
    public lockTime: string;
    public blockchains: BlockchainType[];

    public addressInfo: any = false;
    
    // We'll let users set the date in the past. The genesis block was in 2009, so somewhere near that seems like a reasonable minimum date.
    private minLockDate: Date = new Date( Date.UTC(2010,0,1) );
    // nLockTIme is a 4-byte unsigned integer, so the max value (in seconds since 1970) ends up being in the year 2106
    private maxLockDate: Date = new Date( Date.UTC(2106,0,1) );

    @Input() set selectedBlockchain( chain ) {
        this._blockchainService.setBlockchainType( chain );
    }
    get selectedBlockchain() {
        return this._blockchainService.getBlockchainType();
    }


    constructor( private _blockchainService: BlockchainService,
        private _timeLockService: TimeLockService,
        private _dialog: MatDialog,
        private _constants: ConstantsService
    ) {
        // Initialize with current local date and time
        let nowOffset = new Date();
        this.lockDate = new Date();
        this.lockTime = nowOffset.toISOString().substring( 11, 16 );

        // Init blockchain select
        this.blockchains = BlockchainType.allTypes;
        this.selectedBlockchain = BlockchainType.BTC;

        // Set default blockchain and lockscript type
        this._timeLockService.setTimeLockType( TimeLockTypes.PKH );
    }


    public createTimeLockedAddress( lockDate: Date, lockTime: string ) {
        
        try {
            if ( lockDate === null ) throw 'Invalid date.';
            if ( lockTime === '' ) throw 'Invalid time.';
            if ( this.lockDate < this.minLockDate ) throw 'Date must be after ' + this.minLockDate.toDateString();
            if ( this.lockDate > this.maxLockDate ) throw 'Date must be before ' + this.maxLockDate.toDateString();
            
            // Apply the time to the date
            let submitDate = new Date( lockDate.getTime() );
            let time = lockTime.split( ':' );
            submitDate.setHours( parseInt(time[0]) );
            submitDate.setMinutes( parseInt(time[1]) );
            if ( isNaN(submitDate.getTime()) ) throw 'Invalid date.';

            // Convert to seconds, UTC time
            let lockTimeSeconds = Math.round( submitDate.getTime() / 1000 );

            // Generate P2SH CLTV redeemScript and address, spendable by a newly generated private key
            let bitcoreLib = this._blockchainService.getBlockchainType().bitcoreLib;
            let privateKey = new bitcoreLib.PrivateKey();
            let redeemScript = this._timeLockService.buildRedeemScript( lockTimeSeconds, privateKey );

            let redeemData = {
                version: this._constants.version,
                blockchain: this.selectedBlockchain.shortName,
                redeemKey: privateKey.toWIF(),
                redeemScript: redeemScript.toString(),
            };

            this.addressInfo = {
                lockTime: new Date( lockTimeSeconds * 1000 ),
                p2shAddress: bitcoreLib.Address.payingTo( redeemScript ).toString(),
                redeemJSON: JSON.stringify( redeemData )
            };

        } catch( error ) {
            this.showError( error );
        }
    }

    public showError( e: Error | string ) {
        if ( typeof e === 'string' ) e = new Error( e );
        this._dialog.open( BasicDialog, { data: {
            title: 'Error',
            body: e.message
        }});
    }

    ngOnInit() {
    }

}
