import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatSnackBar } from '@angular/material';


@Component({
    selector: 'basicDialog',
    templateUrl: './basic-dialog.component.html',
    styleUrls: ['./basic-dialog.component.scss']
})
export class BasicDialog {
    constructor(
        public dialogRef: MatDialogRef<BasicDialog>,
        @Inject(MAT_DIALOG_DATA) public data: any,
        private _snackBar: MatSnackBar ) {}

    public copyToClipboard() {
        ( document.querySelector('#infoToCopy') as HTMLInputElement ).select();
        document.execCommand( 'copy' );
        this._snackBar.open( 'Copied to clipboard.', '', {duration:1500} );
    }
}