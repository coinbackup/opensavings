import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';


@Component({
    selector: 'numberInputDialog',
    templateUrl: './number-input-dialog.component.html',
    styleUrls: ['./number-input-dialog.component.scss']
})
export class NumberInputDialog {

    inputValue;
    
    constructor(
        public dialogRef: MatDialogRef<NumberInputDialog>,
        @Inject(MAT_DIALOG_DATA) public data: {
            message: string,
            inputLabel: string,
            defaultValue: number
        }
    ) {
        this.inputValue = data.defaultValue || 1;
    }
    
}