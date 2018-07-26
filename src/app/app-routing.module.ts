import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { IntroComponent } from './components/intro/intro.component';
import { HomeComponent } from './components/home/home.component';
import { CreateComponent } from './components/create/create.component';
import { CheckBalanceComponent } from './components/check-balance/check-balance.component';
import { RedeemComponent } from './components/redeem/redeem.component';

const routes: Routes = [
    {
        path: '',
        component: IntroComponent
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
    }
];

@NgModule({
    imports: [RouterModule.forRoot(routes, {useHash: true})],
    exports: [RouterModule]
})
export class AppRoutingModule { }
