import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { Stream } from 'stream';
import jsQR from 'jsqr';

@Component({
    selector: 'qr-scanner',
    templateUrl: './qr-scanner.component.html',
    styleUrls: ['./qr-scanner.component.scss']
})
export class QrScannerComponent implements OnInit {

    public static instance: QrScannerComponent;
    public static onQrScanSuccess: Function = (decoded) => {};
    public static onQrScanFailure: Function = (message) => {};

    // initialize flags
    getUserMediaIsSupported: boolean = false;
    qrScanSuccess: boolean = false;
    showSelectPhotoBtn: boolean = true;

    // initialize settings for the scanning overlay/video feed
    overlay = {
        showLoadingAnimation: false,
        showCameraInstructions: false,
        isVisible: false,
        isOpaque: false
    };

    private webcamIsOn: boolean = false;
    private stopWebcamFlag: boolean = false;
    private stopWebcamCallback: Function;
    private webcamStream;

    @ViewChild( 'cameraVideo' ) cameraVideo: ElementRef;
    @ViewChild( 'cameraCanvas' ) cameraCanvas: ElementRef;

    constructor() {
        QrScannerComponent.instance = this;

        // alter the navigator.getUserMedia method for cross-browser support for getting a camera feed
        if ( navigator.mediaDevices && navigator.mediaDevices.getUserMedia ) {
            navigator.getUserMedia = ( options, successCb, errorCb ) => {
                navigator.mediaDevices.getUserMedia( options )
                .then( stream => successCb(stream) )
                .catch( err => errorCb(err) );
            };
        } else {
            navigator.getUserMedia = navigator.getUserMedia || navigator['webkitGetUserMedia'] || navigator['mozGetUserMedia'];
        }
        this.getUserMediaIsSupported = !!navigator.getUserMedia;
    }
    
    ngOnInit() {
    }

    // handle a qr image from a file input element
    onQRFileChange( element ) {
        this.qrScanSuccess = false;
        // slight delay to let the success message disappear
        setTimeout( () => {
            let file = element.files[0];
            let reader = new FileReader();
            reader.addEventListener( 'load', () => {
                // conver the contents of the file into an image
                let img = new Image;
                img.addEventListener( 'load', () => {
                    let decoded = this.decodeQRFromImageSource( this.cameraCanvas.nativeElement, img, img.width, img.height );
                    
                    if ( decoded ) {
                        // return the decoded qr text
                        QrScannerComponent.onQrScanSuccess( decoded.data );
                        this.qrScanSuccess = true;
                    } else {
                        // show qr 
                        QrScannerComponent.onQrScanFailure( 'Failed to read QR code.' );
                    }
                    this.hideQROverlay();
                });
                img.addEventListener( 'error', () => QrScannerComponent.onQrScanFailure('Failed to read QR code.') );
                img.src = reader.result;
            }, false );

            if ( file ) {
                this.showQROverlay( true );
                reader.readAsDataURL( file );
            }
        }, 10 );
    }

    scanQR() {
        this.qrScanSuccess = false;
        // get the rear camera if possible
        let webcamOptions: any = {facingMode: 'environment'};
        
        // try selecting an exact camera, because facingMode doesn't always work
        if ( navigator.mediaDevices && navigator.mediaDevices.enumerateDevices ) {
            try {
                navigator.mediaDevices.enumerateDevices().then( devices => {
                    let backCamera = devices.find( device => device.kind === 'videoinput' && device.label.toLowerCase().indexOf('back') > -1 );
                    if ( backCamera ) {
                        webcamOptions = { deviceId: { exact: backCamera.deviceId } };
                    }
                    this.startWebcam( webcamOptions );
                });
            } catch(e) {
                this.startWebcam( webcamOptions );
            }
        } else {
            this.startWebcam( webcamOptions );
        }
    }

    private startWebcam( webcamOptions: any ) {
        this.webcamIsOn = true;
        
        this.showQROverlay( false );
        
        if ( navigator.getUserMedia ) {
            let successCallback: NavigatorUserMediaSuccessCallback = ( stream: any ) => {
                this.webcamStream = stream;
                this.setVideoSrc( stream );
            }
            let errorCallback: NavigatorUserMediaErrorCallback = ( e ) => {
                let message;
                switch ( e.name ) {
                    case 'DevicesNotFoundError':
                    case 'NotFoundError':
                        message = 'Your device does not have a camera.';
                        break;
                    case 'NotAllowedError':
                    case 'PermissionDeniedError':
                    case 'PermissionDismissedError':
                        message = 'You must give this website permission to use the camera in order to scan a QR code.';
                        break;
                    case 'SourceUnavailableError':
                        message = 'Your camera is currently being used by another application. Quit that application and try again.';
                        break;
                    case 'TrackStartError':
                    case 'NotReadableError':
                        message = 'There was a hardware error while attempting to use the camera.';
                        break;
                    case 'SecurityError':
                        message = 'You must change "http://" to "https://" in the address bar in order to use the camera.';
                        break;
                    default:
                        if ( e.message.indexOf('Only secure origins are allowed') !== -1 ) {
                            message = 'You must change "http://" to "https://" in the address bar in order to use the camera.';
                        } else {
                            message = 'There was an error while turning the camera on: ' + ( e.message ? e.message : e.name );
                        }
                }
                QrScannerComponent.onQrScanFailure( message );
                setTimeout( () => this.stopWebcam(), 100 );
            }

            // if a specific camera isn't defined, try to get the highest resolution possible
            if ( webcamOptions === true || webcamOptions.deviceId === undefined || webcamOptions.deviceId.exact === undefined ) {
                webcamOptions = {
                    optional: [
                        {minWidth: 320},
                        {minWidth: 640},
                        {minWidth: 1024},
                        {minWidth: 1280},
                        {minWidth: 1920},
                        {minWidth: 2560}
                    ]
                };
            }
            
            navigator.getUserMedia( {video: webcamOptions, audio: false}, successCallback, errorCallback );
            requestAnimationFrame( this.videoTick.bind(this) );
        } else {
            // getUserMedia is not defined. We can't get the webcam feed, so turn off the cam.
            setTimeout( () => {
                this.stopWebcam();
                this.videoTick();
            }, 100 );
        }
    }
    
    public stopWebcam( cb?: Function ) {
        if ( this.webcamIsOn ) {
            this.stopWebcamFlag = true;
            this.stopWebcamCallback = cb;
        }
        this.webcamIsOn = false;
    }

    private videoTick() {
        if ( this.stopWebcamFlag ) {
            this.stopWebcamFlag = false;
            // set the video element to undefined and stop scanning for QR codes
            this.setVideoSrc();
            if ( this.webcamStream ) {
                try {
                    this.webcamStream.getTracks()[0].stop();
                } catch( e ) {
                    if ( this.webcamStream.stop ) this.webcamStream.stop();
                }
            }
            
            this.webcamStream = undefined;
            this.hideQROverlay();

            setTimeout( () => {
                if ( this.stopWebcamCallback ) {
                    this.stopWebcamCallback();
                    this.stopWebcamCallback = undefined;
                }
            }, 10 );
            return;
        } else {
            // repeat this function once every half second
            setTimeout( () => requestAnimationFrame( this.videoTick.bind(this) ), 500 );
        }

        if ( !this.cameraVideo ) return;
        let video = this.cameraVideo.nativeElement;
        let canvas = this.cameraCanvas.nativeElement;
        if ( video.readyState == video.HAVE_ENOUGH_DATA ) {

            this.overlay.showCameraInstructions = true;

            var decoded = this.decodeQRFromImageSource( canvas, video, video.videoWidth, video.videoHeight );

            if ( decoded ) {
                // return the decoded qr text
                QrScannerComponent.onQrScanSuccess( decoded.data );
                
                this.stopWebcam( () => this.qrScanSuccess = true );
            } else {
                // no QR code found in the image. Do nothing and keep scanning...
            }
        }
    }
    
    // returns decoded QR data on success, or false on failure.
    private decodeQRFromImageSource( targetCanvas: HTMLCanvasElement, imageSource: HTMLImageElement, width: number, height: number ) {
        // normalize the input image so that the smallest dimension is 1000 pixels
        let ratio = Math.min( width, height ) / 1000;
        width /= ratio;
        height /= ratio;
        targetCanvas.width = width;
        targetCanvas.height = height;
        var context = targetCanvas.getContext( '2d' );
        // Load the image onto the canvas
        context.drawImage( imageSource, 0, 0, width, height );
        // Load the image data from the canvas and analyze it for qr codes

        var imageData = context.getImageData( 0, 0, width, height );
        return jsQR( imageData.data, imageData.width, imageData.height );
    }

    private hideQROverlay() {
        this.overlay.isVisible = false;
    }

    private showQROverlay( showLoadingAnimation: boolean ) {
        this.overlay.isVisible = true;
        this.overlay.isOpaque = false;
        setTimeout( () => this.overlay.isOpaque = true, 50 ); // this fades in the div. Curiously, the timeout is required for it to work right
        this.overlay.showCameraInstructions = false; // hide the instructions until the camera feed has loaded
        this.overlay.showLoadingAnimation = showLoadingAnimation;
    }

    // src should be a stream object or undefined
    private setVideoSrc( src?: Stream | string ) {
        let video = this.cameraVideo.nativeElement;
        var URLobj = window.URL || window['webkitURL'];
        src = src || '';
        if ( URLobj ) {
            try {
                video.src = src === '' ? src : URLobj.createObjectURL( src );
            } catch ( e ) {
                video.srcObject = src;
            }
        } else if ( video.mozSrcObject !== undefined ) {
            video.mozSrcObject = src;
        } else {
            video.src = src;
        }
    }

}



/*

window.createQrScannerInstance = function() {


    window.addEventListener( 'afterIotavmInit', function() {
        // modify "Scan QR code" buttons
        // The default behavior is to scan a video stream, but some devices (iOS) don't
        // support this. An input field lets us utilize the camera to take a picture instead.
        // I want the input field to be "styled" like the Scan QR button. Basically just make
        // the input field have low opacity and slap it right on top of the Scan QR button,
        // which is nicely styled.

        // If getUserMedia is supported, there will be two buttons:
        // one that says "Scan QR code" and starts the webcam, and another that says "Take a photo..." or "Select a photo..." (using the <input> tag)
        // If getUserMedia isn't supported, there will be one button that says "Scan QR code" but allows the user to take a photo (using the <input> tag).
        var facadeButton;
        if ( getUserMediaIsSupported ) {
            facadeButton = elements.selectPhotoBtn;
        } else {
            facadeButton = elements.defaultScanBtn;
            vm.showSelectPhotoBtn = false;
        }

        // keep the input element on top of the facade button
        setInterval( function() {
            elements.fallbackScanBtn.style.width = facadeButton.clientWidth + 'px';
            elements.fallbackScanBtn.style.height = facadeButton.clientHeight + 'px';
            elements.fallbackScanBtn.style.top = facadeButton.offsetTop + 'px';
            elements.fallbackScanBtn.style.left = facadeButton.offsetLeft + 'px'
        }, 500 );
    });

};

*/