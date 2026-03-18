export interface UnsignedEvent {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
    pubkey: string;
}

export interface SignedEvent {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
    pubkey: string;
    id: string;
    sig: string;
}
