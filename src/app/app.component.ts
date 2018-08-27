import { Component, ChangeDetectorRef } from '@angular/core';
import { MediaMatcher } from '@angular/cdk/layout';
import { Router } from '@angular/router';
import { ElectronService } from './providers/electron.service';
import { TranslateService } from '@ngx-translate/core';
import { AppConfig } from '../environments/environment';
import { SmoothScroll } from './services/smooth-scroll/smooth-scroll.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent {
    public navItems = [
        {
            link: '/home',
            label: 'Home'
        }, {
            link: '/create',
            label: 'Create address'
        }, {
            link: '/check-balance',
            label: 'Check balance'
        }, {
            link: '/redeem',
            label: 'Redeem coins'
        }
    ];

    mobileQuery: MediaQueryList;

    private _mobileQueryListener: () => void;

    constructor(
        public electronService: ElectronService,
        public router: Router,
        private translate: TranslateService,
        private changeDetectorRef: ChangeDetectorRef,
        private media: MediaMatcher,
        private smoothScroll: SmoothScroll
    ) {

        translate.setDefaultLang('en');
        console.log('AppConfig', AppConfig);

        if (electronService.isElectron()) {
            console.log('Mode electron');
            console.log('Electron ipcRenderer', electronService.ipcRenderer);
            console.log('NodeJS childProcess', electronService.childProcess);
        } else {
            console.log('Mode web');
            // add download page
            this.navItems.splice( 1, 0, {
                link: '/download',
                label: 'Download'
            });
        }

        // watch for changes in browser width
        this.mobileQuery = media.matchMedia( '(max-width: 600px)' );
        this._mobileQueryListener = () => changeDetectorRef.detectChanges();
        this.mobileQuery.addListener( this._mobileQueryListener );
        smoothScroll.mobileQuery = this.mobileQuery;
    }
}
