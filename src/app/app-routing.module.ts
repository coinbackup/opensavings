import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DownloadComponent } from './components/download/download.component';
import { HomeComponent } from './components/home/home.component';
import { CreateComponent } from './components/create/create.component';
import { CheckBalanceComponent } from './components/check-balance/check-balance.component';
import { RedeemComponent } from './components/redeem/redeem.component';

const routes: Routes = [
    {
        path: 'download',
        component: DownloadComponent
    }, {
        path: 'home',
        component: HomeComponent
    }, {
        path: 'create',
        component: CreateComponent
    }, {
        path: 'check-balance',
        component: CheckBalanceComponent
    }, {
        path: 'redeem',
        component: RedeemComponent
    }, {
        path: '',
        redirectTo: '/home',
        pathMatch: 'full'
    }
];

@NgModule({
    imports: [RouterModule.forRoot(routes, {useHash: true})],
    exports: [RouterModule]
})
export class AppRoutingModule { }
