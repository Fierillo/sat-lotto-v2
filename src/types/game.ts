export interface Bet {
    id?: number;
    pubkey: string;
    target_block: number;
    selected_number: number;
    payment_request?: string;
    payment_hash?: string;
    is_paid: boolean;
    betting_block: number;
    nip05?: string;
    created_at?: string;
}

export interface Champion {
    pubkey: string;
    nip05?: string;
    sats_earned: number;
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

export interface GameStateResponse {
    block: { height: number; target: number; poolBalance: number };
    activeBets: Bet[];
    champions: Champion[];
    lastResult: SorteoResult | null;
}

export interface BetResponse {
    paymentRequest: string;
    paymentHash: string;
}
