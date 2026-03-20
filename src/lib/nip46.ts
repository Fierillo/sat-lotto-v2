import NDK, { NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import ndk from './ndk';

export const NIP46_RELAYS = [
    'wss://relay.damus.io',
    'wss://relay.primal.net',
    'wss://nos.lol',
    'wss://relay.nsec.app',
];

export interface BunkerSession {
    bunkerTarget: string;
    localSignerPrivkey: string;
}

export function generateConnectUri(): { uri: string; secret: string } {
    const localSigner = NDKPrivateKeySigner.generate();
    const localPubkey = localSigner.pubkey;
    const secret = Math.random().toString(36).substring(2, 15);
    
    let uri = `nostrconnect://${localPubkey}?`;
    NIP46_RELAYS.forEach(r => {
        uri += `relay=${encodeURIComponent(r)}&`;
    });
    uri += `secret=${encodeURIComponent(secret)}&name=${encodeURIComponent('SatLotto')}&url=${encodeURIComponent('https://satlotto.com')}`;
    
    return { uri, secret };
}

export async function createBunkerSession(bunkerUrl: string): Promise<{
    session: BunkerSession;
    signer: NDKNip46Signer;
}> {
    const localSigner = NDKPrivateKeySigner.generate();
    
    const signer = NDKNip46Signer.bunker(ndk, bunkerUrl, localSigner);
    
    signer.on('authUrl', (url: string) => {
        console.log('[NIP-46] Auth URL:', url);
    });
    
    const user = await signer.blockUntilReady();
    const userPubkey = user.pubkey;
    
    if (!userPubkey) {
        throw new Error('Failed to get public key from bunker');
    }
    
    const session: BunkerSession = {
        bunkerTarget: bunkerUrl,
        localSignerPrivkey: localSigner.privateKey,
    };
    
    return { session, signer };
}

export function restoreBunkerSession(session: BunkerSession): NDKNip46Signer {
    const localSigner = new NDKPrivateKeySigner(session.localSignerPrivkey);
    return NDKNip46Signer.bunker(ndk, session.bunkerTarget, localSigner);
}

export function serializeSession(session: BunkerSession): string {
    return JSON.stringify(session);
}

export function deserializeSession(data: string): BunkerSession {
    return JSON.parse(data);
}
