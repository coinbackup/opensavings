import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class SmoothScroll {
    constructor() {
    }

    mobileQuery; // set by app.component

    public to( element, duration = 400 ) {
        if ( !element ) return;
        // depending on whether we're in mobile or desktop mode, scroll either the window or the mat-sidenav-content
        // scroll the window smoothly so that the given element is at the top of the window
        let scrollEl: any, maxScroll: number, initialScrollPos: number, topPadding: number;
        if ( this.mobileQuery.matches ) {
            scrollEl = window;
            maxScroll = Math.max( 0, document.querySelector( '.mat-sidenav-content' ).scrollHeight - window.innerHeight );
            initialScrollPos = window.pageYOffset || document.body.scrollTop || document.documentElement.scrollTop || 0;
            topPadding = 60;
        } else {
            scrollEl = document.querySelector( '.mat-sidenav-content' );
            maxScroll = Math.max( 0, scrollEl.scrollHeight - scrollEl.clientHeight );
            initialScrollPos = scrollEl.scrollTop;
            topPadding = 115;
        }

        let targetScrollPos = Math.max( 0, element.getBoundingClientRect().top + initialScrollPos - topPadding );
        targetScrollPos = Math.min( maxScroll, targetScrollPos );
        let scrollDiff = targetScrollPos - initialScrollPos;
        let startTime = new Date().getTime();
        // set an interval to fire the scrolling at a rate of 60Hz
        let interval = setInterval( () => {
            let newScrollPos = this.easeInOutQuad( initialScrollPos, scrollDiff, new Date().getTime() - startTime, duration );
            if ( this.mobileQuery.matches ) {
                window.scroll( undefined, newScrollPos );
            } else {
                scrollEl.scrollTop = newScrollPos;
            }
        }, 16.66 );

        // kill the interval after [duration] has passed
        setTimeout( () => clearInterval(interval), duration );
    }

    // horrendous easing equation courtesy of http://robertpenner.com/easing/
    private easeInOutQuad( start:number, diff:number, time:number, duration:number ){
        if ( (time /= duration/2) < 1 ) {
            return diff/2 * time * time + start;
        }
        return -diff/2 * ( (--time) * (time-2) - 1 ) + start;
    }
}
