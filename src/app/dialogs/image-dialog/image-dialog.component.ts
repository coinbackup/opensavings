import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';


@Component({
    selector: 'imageDialog',
    templateUrl: './image-dialog.component.html',
    styleUrls: ['./image-dialog.component.scss']
})
export class ImageDialog {
    constructor(
        public dialogRef: MatDialogRef<ImageDialog>,
        @Inject(MAT_DIALOG_DATA) public imgSrc: string ) {}
}