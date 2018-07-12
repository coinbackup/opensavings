import { Component, OnInit } from '@angular/core';

//@@
import * as Bitcore from 'bitcore-lib';
import * as Explorers from 'bitcore-explorers';
import * as QRCode from 'qrcode';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

    addressQrData: string;
    insight;
    checkForTxInterval;
    foundTx: boolean = false;

    readonly network = Bitcore.Networks.testnet;
    readonly insightURL = 'https://test-insight.bitpay.com';

    constructor() {
    }
    
    createSendAddress() {
    
        //privkey: cS8U24mecmVN5acy84f4SgT46a8ACV9bmnMRKubfqQkfFdxdvyea
        //address: mgXd5qiQPrtHeYJCLpZ7KKPmsBNjX9Pk39
    
        // Generate a new private key and address for the user to send coins to
        //@@let privateKey = new Bitcore.PrivateKey(),
        let privateKey = new Bitcore.PrivateKey( 'cUjcN5ghwqKvnq3p4LzrqLdESnzyhaxNvc4upziNTybAHmDNVMWJ' ),
            publicKey = privateKey.toPublicKey(),
            address = publicKey.toAddress( this.network );
        
        // Create an SVG QR code from the address and show it to the user
        // The width of the image needs to be large enough to appear sharp on all screens
        QRCode.toDataURL( address.toString(), {width: 800} )
        .then( url => {
            this.addressQrData = url;
            // Now listen for a tx to be sent there
            this.checkForTxInterval = setInterval( () => {
                this.checkForTx( address );
            }, 2000 );
        })
        .catch( err => {
    
        });
    }

    checkForTx( address: string ) {
        if ( !this.insight ) {
            this.insight = new Explorers.Insight( this.insightURL, this.network );
        }
        this.insight.getUnspentUtxos( address, (err, utxos) => {
            if ( err ) {
                console.log( 'oops', err );
            } else {
                console.log( utxos );
                if ( utxos.length > 0 ) {
                    clearInterval( this.checkForTxInterval );
                    this.foundTx = true;
                }
            }
        });
    }

    ngOnInit() {
    }




















    sendCoins() {
        var wallet1 = {
            key: 'cUjcN5ghwqKvnq3p4LzrqLdESnzyhaxNvc4upziNTybAHmDNVMWJ',
            addr: 'mfjHUg1JM7vrTaEE8r54Xn5DSEgkE87URv',
            toAddr: undefined
        };
        var wallet2 = {
            key: 'cQCBHxXKWuRf4DNMKJNJDfBx78oqsScyvLkvE4gavywUWNuveogk',
            addr: 'mgBaw8ZP34t5iwxarTGCnG2Y9XfawKZKmn',
            toAddr: undefined
        };
        var wallet3 = {
            key: 'cS8U24mecmVN5acy84f4SgT46a8ACV9bmnMRKubfqQkfFdxdvyea',
            addr: 'mgXd5qiQPrtHeYJCLpZ7KKPmsBNjX9Pk39',
            toAddr: undefined
        };
        wallet1.toAddr = wallet3.addr;
        wallet3.toAddr = wallet1.addr;

        var wallet = wallet3;

        // 10 satoshis per byte

        var fee = 0.001;

        sendMoneys(
            
            wallet.key,
            wallet.addr,
            '7c169eaa70433654d67216f496f92f124f1e3799ce49093f9c0617de1f780842',
            1,
            wallet.toAddr, // greenaddress wallet //wallet.toAddr,
            2.088,
            0.1
            

            /*
            // send from wallet1 back to faucet
            wallet1.key,
            wallet1.addr,
            '7c169eaa70433654d67216f496f92f124f1e3799ce49093f9c0617de1f780842',
            0,
            '2N8hwP1WmJrFF5QWABn38y63uYLhnJYJYTF',
            0.1,
            0.1 - fee
*/
        ).then(
            function( message ) {
                console.log( message );
            },
            function( error ) {
                console.error( error );
            }
        );


        function sendMoneys( fromPrivateKey, fromAddr, fromTxId, fromTxIndex, toAddr, amountBtcFrom, amountBtcSend ) {
            return new Promise( function(resolve,reject) {
                var privateKey = new Bitcore.PrivateKey( fromPrivateKey );
                var utxo = {
                    txId: fromTxId,
                    outputIndex: fromTxIndex,
                    script: Bitcore.Script.buildPublicKeyHashOut( Bitcore.Address.fromString(fromAddr) ),
                    satoshis: BTCtoSatoshis( amountBtcFrom )
                };

                try {
                    var someTimeFromNow = new Date( Date.now() - (2 * 3600 * 1000) ); // two hours ago, actually
                    someTimeFromNow.setMilliseconds( 0 ); // This gives a nice round number when converting the date to seconds since Unix epoch

                    var transaction = new Bitcore.Transaction()
                    .lockUntilDate( someTimeFromNow )
                    .from( utxo )
                    // for now, send 0.1 BTC
                    .to( toAddr, BTCtoSatoshis(amountBtcSend) )
                    .change( fromAddr )
                    // for now, always a fee of 0.001 tBTC
                    .fee( BTCtoSatoshis(fee) );
                    
                    // Change the sequence number of the input to enable locktime.
                    // The standard way to do this is to set nSequence to 0.
                    // 'lockUntilDate()' doesn't set the sequence number... whoops?
                    transaction.inputs[0].sequenceNumber = 0;
                    // Sign that bitch
                    transaction.sign( privateKey );

                    var sError;
                    // intentional '=' in the if-statement
                    if ( sError = transaction.getSerializationError() ) {
                        return reject( sError.message );
                    }

                    // broadcast to bitpay node
                    var insight = new Explorers.Insight( 'https://test-insight.bitpay.com', Bitcore.Networks.testnet );
                    //var insight = new Insight( 'https://www.localbitcoinschain.com', Bitcore.Networks.testnet );
                    
                    
                    insight.broadcast( transaction, function(error, newTxId) {
                        if ( error ) {
                            reject( 'Error in broadcast:' + error );
                        } else {
                            resolve( 'txId:' + newTxId );
                        }
                    });
                    

                } catch ( error ) {
                    return reject( error.message );
                }
            });
        }



        function BTCtoSatoshis( btcAmount ) {
            return Bitcore.Unit.fromBTC( btcAmount ).toSatoshis();
        }

        // send to mgBaw:
        // OP_DUP OP_HASH160 074e6436e1db7f9ec955328258217cbf700165a7 OP_EQUALVERIFY OP_CHECKSIG
        // send to mfjH:
        // OP_DUP OP_HASH160 025501393e38a07442fa0ad3cab01b750bc5d0a8 OP_EQUALVERIFY OP_CHECKSIG
    }

}
