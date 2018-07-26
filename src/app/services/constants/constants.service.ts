import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class ConstantsService {

    public readonly version: number = 1;
    
    constructor() {}
}
