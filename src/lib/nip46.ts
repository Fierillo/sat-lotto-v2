/**
 * NIP-46: Bunker (Remote Signer)
 * Uses NDK for signing. May have wallet (NWC) connected internally.
 */

import NDK, { NDKNip46Signer, NDKEvent } from '@nostr-dev-kit/ndk';
import { getOrCreateLocalSigner } from '../auth/auth-utils';

let signer: NDKNip46Signer | null = null;
let ndkInstance: NDK | null = null;

export const NIP46 = {
    name: 'nip46' as const,
    canPay: false,

    async connect(bunkerUri: string, ndk: NDK): Promise<string> {
        const url = new URL(bunkerUri.replace('bunker://', 'http:'));
        const relays = url.searchParams.getAll('relay');

        ndkInstance = ndk;
        if (relays.length > 0) {
            relays.forEach(r => ndk.addExplicitRelay(r));
        }
        await ndk.connect(5000);

        signer = new NDKNip46Signer(ndk, bunkerUri, getOrCreateLocalSigner());
        (signer as any).ndk = ndk;
        await signer.blockUntilReady();

        const user = await signer.user();
        return user.pubkey;
    },

    getSigner(): NDKNip46Signer | null {
        return signer;
    },

    async signEvent(event: any): Promise<any> {
        if (!signer || !ndkInstance) throw new Error('NIP-46 not connected. Call connect() first.');
        const ndkEvent = new NDKEvent(ndkInstance);
        ndkEvent.kind = event.kind;
        ndkEvent.created_at = event.created_at || Math.floor(Date.now() / 1000);
        ndkEvent.tags = event.tags || [];
        ndkEvent.content = event.content || '';
        ndkEvent.pubkey = event.pubkey || '';
        await signer.sign(ndkEvent as any);
        return ndkEvent.rawEvent();
    }
};
