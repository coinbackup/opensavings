import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class SmoothScroll {
    constructor() {
    }

    public to( element, duration = 400, topPadding = 50 ) {
        // scroll the window smoothly so that the given element is at the top of the window
        let initialScrollPos = window.pageYOffset || document.body.scrollTop || document.documentElement.scrollTop || 0;
        let targetScrollPos = Math.max( 0, element.getBoundingClientRect().top + initialScrollPos - topPadding );
        let maxScroll = Math.max( 0, document.body.scrollHeight - window.innerHeight );
        targetScrollPos = Math.min( maxScroll, targetScrollPos );
        let scrollDiff = targetScrollPos - initialScrollPos;
        let startTime = new Date().getTime();

        // set an interval to fire the scrolling at a rate of 60Hz
        let interval = setInterval( () => {
            let newScrollPos = this.easeInOutQuad( initialScrollPos, scrollDiff, new Date().getTime() - startTime, duration );
            window.scroll( undefined, newScrollPos );
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
