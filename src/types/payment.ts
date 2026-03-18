export interface InvoiceResult {
    invoice: string;
    payment_hash: string;
}

export interface NwcInvoiceResult {
    payment_request: string;
    payment_hash: string;
    preimage?: string;
    settled?: boolean;
}
