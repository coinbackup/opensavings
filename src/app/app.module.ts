import 'zone.js/dist/zone-mix';
import 'reflect-metadata';
import '../polyfills';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { HttpClientModule, HttpClient } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';

// NG material
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatCardModule, MatButtonModule, MatProgressSpinnerModule, MatInputModule, MatNativeDateModule, MatIconModule, MatToolbarModule } from '@angular/material';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSnackBarModule } from '@angular/material/snack-bar';

// NG Translate
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { ElectronService } from './providers/electron.service';

import { WebviewDirective } from './directives/webview.directive';


import { AppComponent } from './app.component';
import { IntroComponent } from './components/intro/intro.component';
import { CreateComponent } from './components/create/create.component';
import { CheckBalanceComponent } from './components/check-balance/check-balance.component';
import { RedeemComponent } from './components/redeem/redeem.component';
import { HomeComponent } from './components/home/home.component';
import { QrScannerComponent } from './components/qr-scanner/qr-scanner.component';

import { BasicDialog } from './dialogs/basic-dialog/basic-dialog.component';
import { ImageDialog } from './dialogs/image-dialog/image-dialog.component';
import { ConfirmDialog } from './dialogs/confirm-dialog/confirm-dialog.component';

// AoT requires an exported function for factories
export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
    declarations: [
        AppComponent,
        HomeComponent,
        WebviewDirective,
        // Dialogs
        BasicDialog, ImageDialog, ConfirmDialog,
        IntroComponent,
        CreateComponent,
        CheckBalanceComponent,
        RedeemComponent,
        QrScannerComponent
    ],
    entryComponents: [
        BasicDialog,
        ImageDialog,
        ConfirmDialog
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        BrowserAnimationsModule,
        FormsModule,
        HttpClientModule,
        TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: (HttpLoaderFactory),
                deps: [HttpClient]
            }
        }),
        MatCardModule, MatButtonModule, MatProgressSpinnerModule, MatInputModule, MatNativeDateModule, MatIconModule, MatToolbarModule,
        MatSelectModule,
        MatDialogModule,
        MatSidenavModule,
        MatListModule,
        MatDatepickerModule,
        MatSnackBarModule
    ],
    providers: [ElectronService],
    bootstrap: [AppComponent]
})
export class AppModule { }
