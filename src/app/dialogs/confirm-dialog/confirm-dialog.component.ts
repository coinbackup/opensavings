import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';


@Component({
    selector: 'confirmDialog',
    templateUrl: './confirm-dialog.component.html',
    styleUrls: ['./confirm-dialog.component.scss']
})
export class ConfirmDialog {
    constructor(
        public dialogRef: MatDialogRef<ConfirmDialog>,
        @Inject(MAT_DIALOG_DATA) public txDetails: any ) {}
    
    getUSDAmount( coins:number ): string {
        let usd = ( coins * this.txDetails.USDPerCoin );
        return usd < 0.01 ? 'less than $0.01 USD' : '$' + usd.toFixed(2) + ' USD';
    }
}