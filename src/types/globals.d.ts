interface NostrExtension {
    getPublicKey(): Promise<string>;
    signEvent(event: any): Promise<any>;
    getRelays?(): Promise<any>;
    nip04?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
    };
}

interface WeblnProvider {
    enable(): Promise<void>;
    sendPayment(invoice: string): Promise<{ preimage: string }>;
    makeInvoice?(amount: number | string, defaultMemo?: string): Promise<any>;
    getBalance?(): Promise<{ balance: number }>;
}

interface Window {
    nostr?: NostrExtension;
    webln?: WeblnProvider;
    updateUI?: () => void;
    updateCenterButton?: () => void;
    makePayment?: () => void;
    selectNumber?: (num: number) => void;
    handleAutoLogin?: () => void;
    handleNwcLogin?: () => void;
    handleBunkerLogin?: () => void;
    initNostrConnect?: () => void;
    lastExternalSig?: any;
}
