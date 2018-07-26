import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';


@Component({
    selector: 'basicDialog',
    templateUrl: './basic-dialog.component.html'
})
export class BasicDialog {
    constructor(
        public dialogRef: MatDialogRef<BasicDialog>,
        @Inject(MAT_DIALOG_DATA) public data: any ) {}
}