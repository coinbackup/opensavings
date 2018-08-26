import { Component, OnInit, Input } from '@angular/core';
import { MatDialog, MatSnackBar } from '@angular/material';
import { TimeLockService } from '../../services/time-lock/time-lock.service';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { BlockchainType } from '../../models/blockchain-types';
import { TimeLockTypes } from '../../models/time-lock-types';
import { ConstantsService } from '../../services/constants/constants.service';
import { BasicDialog } from '../../dialogs/basic-dialog/basic-dialog.component';
import { ImageDialog } from '../../dialogs/image-dialog/image-dialog.component';
import { SmoothScroll } from '../../services/smooth-scroll/smooth-scroll.service';
import * as QRCode from 'qrcode';

@Component({
    selector: 'app-create',
    templateUrl: './create.component.html',
    styleUrls: ['./create.component.scss']
})
export class CreateComponent implements OnInit {

    public lockDate: Date;
    public lockTime: string;
    public blockchains: BlockchainType[];
    buttonDisabled: boolean = false;

    public addressInfo: any = false;
    public redeemData: any;
    
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
        private _snackBar: MatSnackBar,
        private _constants: ConstantsService,
        private _smoothScroll: SmoothScroll
    ) {
        // Initialize with current local date and time
        this.lockDate = new Date();
        this.lockTime = new Date().toTimeString().substring( 0, 5 );

        // Init blockchain select
        this.blockchains = BlockchainType.allTypes;
        this.selectedBlockchain = BlockchainType.BCH;

        // Set default blockchain and lockscript type
        this._timeLockService.setTimeLockType( TimeLockTypes.PKH );
    }


    public createTimeLockedAddress( lockDate: Date, lockTime: string ) {
        this.buttonDisabled = true;
        
        // pause to let the UI update with the spinner
        setTimeout( () => {
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

                this.redeemData = {
                    version: this._constants.version,
                    blockchain: this.selectedBlockchain.shortName,
                    redeemKey: privateKey.toWIF(),
                    redeemScript: redeemScript.toString(),
                };

                let p2shAddress = bitcoreLib.Address.payingTo( redeemScript ).toString();

                // create QR code
                Promise.all([
                    QRCode.toDataURL( p2shAddress, {scale:28} ),
                    QRCode.toDataURL( JSON.stringify(this.redeemData), {scale:28} )
                ])
                .then( dataURLs => {
                    this.addressInfo = {
                        lockTime: new Date( lockTimeSeconds * 1000 ),
                        p2shAddress: p2shAddress,
                        redeemJSON: JSON.stringify( this.redeemData ),
                        addressQRData: dataURLs[0],
                        redeemQRData: dataURLs[1]
                    };
                    setTimeout( () => {
                        this._smoothScroll.to( document.getElementById('success') );
                    }, 100 );
                })
                .catch( e => this.showError(e) )
                ['finally']( () => this.buttonDisabled = false );

            } catch( error ) {
                this.showError( error );
                this.buttonDisabled = false;
            }
        }, 200 );
    }

    // print a single DOM element.
    print( elementId: string ) {
        let element: any = document.getElementById( elementId );
        let oldScrollPos = this.scrollPos();
        // copy the element's outerHTML to a new element, to be appended to the body
        let printContainer = document.createElement( 'div' );
        document.body.appendChild( printContainer );
        printContainer.classList.add( 'print-this' );

        let newElement: any = document.createElement( 'div' );
        printContainer.appendChild( newElement );
        newElement.outerHTML = element.outerHTML;
        // need to reassign what newElement is pointing at since we touched outerHTML
        newElement = printContainer.lastChild;

        // set up the body with a special class to hide everything else
        document.body.classList.add( 'print-single-element' );

        window.print();
        
        // undo everything
        document.body.classList.remove( 'print-single-element' );
        document.body.removeChild( printContainer );
        // restore the old scroll position
        this.scrollPos( oldScrollPos );
        // some browsers require a delay
        setTimeout( () => {
            if ( this.scrollPos() !== oldScrollPos ) {
                this.scrollPos( oldScrollPos );
            }
        }, 150 );
    }

    // Get/set the body y-scroll position.
    scrollPos( newValue?: number ) {
        if ( newValue === undefined ) {
            // get the scroll value.
            return window.pageYOffset || document.body.scrollTop || document.documentElement.scrollTop || 0;
        } else {
            window.scroll( undefined, newValue );
        }
    }

    public showError( e: Error | string ) {
        if ( typeof e === 'string' ) e = new Error( e );
        this._dialog.open( BasicDialog, { data: {
            title: 'Error',
            icon: './assets/img/icons/x.svg',
            body: e.message
        }});
    }

    public showImageDialog( imgSrc: string ) {
        this._dialog.open( ImageDialog, { data: imgSrc } );
    }

    public copyToClipboard( target ) {
        target.select();
        document.execCommand( 'copy' );
        this._snackBar.open( 'Copied to clipboard.', '', {duration:1500} );
    }

    ngOnInit() {
    }

}
