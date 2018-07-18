import { Injectable } from '@angular/core';

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
    // timeoutMs is optional. If not given, no timer is set.
    public raceToSuccess( promises, timeoutMs?: number ): Promise<any> {
        if ( timeoutMs === undefined ) timeoutMs = this.timeoutMs;
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
                errors => reject( errors ),
                // If '.all' rejected, we've got the result we wanted.
                val => resolve( val )
            );

            if ( timeoutMs ) {
                setTimeout( () => reject( 'Timed out.' ), timeoutMs );
            }
        })
    }

    // Fetches and returns a Promise, but rejects on status != 200.
    // JSON-decodes a good result, and text-decodes a bad result
    public fetchJSON( url: string, fetchOptions?: any ): Promise<any> {
        return new Promise( (resolve, reject) => {
            fetch( url, fetchOptions )
            .then( result => {
                if ( result.status === 200 ) {
                    result.json().then( data => resolve(data), err => reject(err) );
                } else {
                    result.text().then( data => reject(data), err => reject(err) );
                }
            })
            .catch( err => {
                reject( err );
            })
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
}
