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

    public lockDate: string;
    public lockTime: string;
    public blockchains: BlockchainType[];

    private _tzOffsetMilliseconds = new Date().getTimezoneOffset() * 60 * 1000;

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
        let nowOffset = new Date( new Date().getTime() - this._tzOffsetMilliseconds ).toISOString();
        this.lockDate = nowOffset.substring( 0, 10 );
        this.lockTime = nowOffset.substring( 11, 16 );

        // Init blockchain select
        this.blockchains = BlockchainType.allTypes;
        this.selectedBlockchain = BlockchainType.BTC;

        // Set default blockchain and lockscript type
        this._timeLockService.setTimeLockType( TimeLockTypes.PKH );
    }


    public createTimeLockedAddress( lockDate, lockTime ) {
        // Convert the local time inputs to Unix seconds
        try {
            let ms = Date.parse( lockDate + 'T' + lockTime + ':00.000Z' )
            let lockTimeSeconds = Math.round( (ms + this._tzOffsetMilliseconds) / 1000 );
            if ( isNaN(lockTimeSeconds) ) {
                throw new Error( 'Invalid date.' );
            }
            
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

            console.log({
                lockTime: new Date( lockTimeSeconds * 1000 ),
                p2shAddress: bitcoreLib.Address.payingTo( redeemScript ).toString(),
                redeemJSON: JSON.stringify( redeemData )
            });

        } catch( error ) {
            this._dialog.open( BasicDialog, { data: {
                title: 'Error',
                body: error.message
            }});
        }
    }

    ngOnInit() {
    }

}
