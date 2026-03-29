import type { NDKEvent } from '@nostr-dev-kit/ndk';
import type { Signer } from './signer';

export interface LoginHandlers {
    onExtLogin: () => void;
    onNwcLogin: () => void;
    onBunkerLogin: () => void;
    onRefreshConnect: () => void;
    onClose: () => void;
}

export interface LogRemoteData {
    msg: string;
    [key: string]: unknown;
}

export interface AuthState {
    pubkey: string | null;
    signer: Signer;
    nwcUrl: string | null;
    bunkerTarget: string | null;
    localPrivkey: string | null;
    nip05: string | null;
    loginEvent: NDKEvent | null;
    loginMethod: string | null;
}
