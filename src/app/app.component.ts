import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ElectronService } from './providers/electron.service';
import { TranslateService } from '@ngx-translate/core';
import { AppConfig } from '../environments/environment';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent {
    public readonly navItems = [
        {
            link: '/intro',
            label: 'Intro'
        }, {
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

    constructor(public electronService: ElectronService,
        public router: Router,
        private translate: TranslateService) {

        translate.setDefaultLang('en');
        console.log('AppConfig', AppConfig);

        if (electronService.isElectron()) {
            console.log('Mode electron');
            console.log('Electron ipcRenderer', electronService.ipcRenderer);
            console.log('NodeJS childProcess', electronService.childProcess);
        } else {
            console.log('Mode web');
        }
    }
}
