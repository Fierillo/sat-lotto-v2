export interface Bet {
    id?: number;
    pubkey: string;
    target_block: number;
    selected_number: number;
    payment_request?: string;
    payment_hash?: string;
    is_paid: boolean;
    betting_block: number;
    alias?: string;
    created_at?: string;
}

export interface UserIdentity {
    pubkey: string;
    alias: string | null;
}

export interface SorteoResult {
    resolved: boolean;
    blockHash?: string;
    winningNumber?: number;
    winners?: Bet[];
    targetBlock: number;
    error?: string;
}

export interface BlockTip {
    height: number;
    target: number;
}

export interface NwcInvoice {
    payment_request: string;
    payment_hash: string;
    preimage?: string;
    settled?: boolean;
}

export interface AuthState {
    pubkey: string | null;
    nwcUrl: string | null;
    bunkerTarget: string | null;
    method: 'extension' | 'nwc' | 'bunker' | null;
}
