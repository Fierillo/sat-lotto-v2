import { NDKPrivateKeySigner, NDKNip46Signer } from '@nostr-dev-kit/ndk';

export type SignerType = 'extension' | 'nwc' | 'bunker' | 'privatekey';

export interface NIP07Signer {
    type: 'extension';
    getPublicKey(): Promise<string>;
    signEvent(event: { kind: number; created_at: number; tags: string[][]; content: string; pubkey: string }): Promise<{ sig: string; id: string }>;
    nip04?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
    };
}

export interface NIP46Signer {
    type: 'bunker';
    user(): Promise<{ pubkey: string }>;
}

export interface NIP55Signer {
    type: 'privatekey';
    pubkey: string;
}

export type Signer = NIP07Signer | NDKNip46Signer | NDKPrivateKeySigner | null;

export function isNIP07Signer(signer: Signer): signer is NIP07Signer {
    return signer !== null && 'type' in signer && signer.type === 'extension';
}

export function isNDKSigner(signer: Signer): signer is NDKNip46Signer | NDKPrivateKeySigner {
    return signer instanceof NDKNip46Signer || signer instanceof NDKPrivateKeySigner;
}
