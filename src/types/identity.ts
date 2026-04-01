export interface Identity {
    pubkey: string;
    nip05?: string | null;
    lud16?: string | null;
    sats_earned: number;
    sats_pending: number;
    winner_block: number;
    can_claim: boolean;
    last_updated?: Date;
}

export interface VictoryStatus {
    winner_block: number;
    can_claim: boolean;
}

export interface IdentityApiResponse {
    pubkey: string;
    nip05: string | null;
    sats_earned: number;
    sats_pending: number;
    lud16: string | null;
    winner_block: number;
    can_claim: boolean;
}

export interface ClaimApiResponse {
    claimed: number;
    lud16?: string;
    error?: string;
}