/**
 * NIP-46: Bunker (Remote Signer)
 * Uses NDK for signing. May have wallet (NWC) connected internally.
 */

import NDK, { NDKNip46Signer, NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { getOrCreateLocalSigner } from '../auth/auth-utils';

let ndk: NDK | null = null;
let signer: NDKNip46Signer | null = null;
let userPubkey: string | null = null;

export const NIP46 = {
    name: 'nip46' as const,
    canPay: false,

    async connect(bunkerUri: string): Promise<string> {
        const url = new URL(bunkerUri.replace('bunker://', 'http://'));
        const relays = url.searchParams.getAll('relay');
        const bunkerPubkey = url.hostname;

        ndk = new NDK({
            explicitRelayUrls: relays.length > 0 ? relays : ['wss://relay.damus.io', 'wss://nos.lol']
        });
        await ndk.connect(5000);

        signer = new NDKNip46Signer(ndk, bunkerUri, getOrCreateLocalSigner());
        await signer.blockUntilReady();

        const user = await signer.user();
        userPubkey = user.pubkey;
        return userPubkey;
    },

    async getPublicKey(): Promise<string> {
        if (!signer) throw new Error('NIP-46 not connected. Call connect() first.');
        const user = await signer.user();
        return user.pubkey;
    },

    async signEvent(event: any): Promise<any> {
        if (!signer || !ndk) throw new Error('NIP-46 not connected');
        const ndkEvent = new NDKEvent(ndk);
        ndkEvent.kind = event.kind;
        ndkEvent.created_at = event.created_at || Math.floor(Date.now() / 1000);
        ndkEvent.tags = event.tags || [];
        ndkEvent.content = event.content || '';
        ndkEvent.pubkey = event.pubkey || '';
        await signer.sign(ndkEvent as any);
        return ndkEvent.rawEvent();
    },

    async payInvoice(invoice: string): Promise<string> {
        throw new Error('Bunker payment not supported. Connect NWC wallet for auto-pay.');
    },

    async getBalance(): Promise<number> {
        throw new Error('Bunker balance not supported via NIP-46');
    }
};
