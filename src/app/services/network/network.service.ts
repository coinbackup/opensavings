import { Injectable } from '@angular/core';
import { AppError } from '../../models/error-types';

// NetworkService provides raw tools to make ajax requests.

@Injectable({
    providedIn: 'root'
})
export class NetworkService {

    public timeoutMs: number = 10000;
    
    constructor() {}

    // Takes an array of Promises and returns a master Promise.
    // As soon as one promise resolves, resolve the master promise with that resolved value.
    // If all the promises reject, reject the master promise with an array of rejected values.
    // This is essentially an inverted Promise.all
    // The error handling assumes all promises will be from fetchJSON or postJSON.
    public raceToSuccess( promises ): Promise<any> {
        return new Promise( (resolve, reject) => {
            Promise.all( promises.map( p => {
                // If a request fails, count that as a resolution so it will keep
                // waiting for other possible successes. If a request succeeds,
                // treat it as a rejection so Promise.all immediately bails out.
                return p.then(
                    val => Promise.reject( val ),
                    err => Promise.resolve( err )
                );
            })).then(
                // If '.all' resolved, we've just got an array of errors.
                errors => reject( this.getUsefulError(errors) ),
                // If '.all' rejected, we've got the result we wanted.
                val => resolve( val )
            );
        })
    }

    // Fetches and returns a Promise, but rejects on status != 200.
    // JSON-decodes a good result, and text-decodes a bad result
    // If timeoutMs is 0 or false, no timeout is set.
    public fetchJSON( url: string, fetchOptions?: any, timeoutMs?: number ): Promise<any> {
        if ( timeoutMs === undefined ) timeoutMs = this.timeoutMs;

        return new Promise( (resolve, reject) => {
            // start a timeout timer.
            if ( timeoutMs ) {
                setTimeout(
                    () => reject( new AppError(AppError.TYPES.FETCH, 'Connection timed out.') ),
                    this.timeoutMs
                );
            }

            // Make the HTTP call
            fetch( url, fetchOptions )
            .then( result => {
                if ( result.status === 200 ) {
                    result.json().then(
                        data => resolve( data ),
                        err => reject( new AppError(AppError.TYPES.UNEXPECTED, JSON.stringify(err)) )
                    );
                } else {
                    result.text().then(
                        data => reject( new AppError(AppError.TYPES.SERVER, data) ),
                        err => reject( new AppError(AppError.TYPES.UNEXPECTED, JSON.stringify(err)) )
                    );
                }
            })
            .catch( err => reject( new AppError(AppError.TYPES.FETCH, err.message) ) )
        })
    }

    public postJSON( url: string, data: any ): Promise<any> {
        return this.fetchJSON( url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            redirect: 'follow',
            body: JSON.stringify( data )
        });
    }

    // selects the most useful error message from multiple.
    private getUsefulError( errors ): AppError {
        // If a server gave a response (4XX/5XX), return that response,
        // otherwise return an error about not being able to make the request,
        // otherwise return whatever error happened.
        return errors.find( err => err.type === AppError.TYPES.SERVER )
            || errors.find( err => err.type === AppError.TYPES.FETCH )
            || errors[0];
    }
}
