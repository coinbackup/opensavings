export class AppError {

    public static TYPES = {
        SERVER: 'SERVER',
        UNEXPECTED: 'UNEXPECTED',
        FETCH: 'FETCH',
        NO_BALANCE: 'NO_BALANCE',
        OTHER: 'OTHER'
    };

    constructor( public type: string, public message: string ) {}
}