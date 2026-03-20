import NDK, { NDKNip46Signer, NDKPrivateKeySigner, NDKEvent } from '@nostr-dev-kit/ndk';
import { nip44 } from 'nostr-tools';

export const NIP46_RELAYS = [
    'wss://relay.damus.io',
    'wss://relay.primal.net',
    'wss://nos.lol',
    'wss://relay.nsec.app',
];

export interface BunkerSession {
    bunkerTarget: string;
    localSignerPrivkey: string;
    remotePubkey: string;
}

export function generateConnectUri(): {
    uri: string;
    secret: string;
    signer: NDKPrivateKeySigner;
    pubkey: string;
} {
    const signer = NDKPrivateKeySigner.generate();
    const pubkey = signer.pubkey;
    const secret = Math.random().toString(36).substring(2, 15);

    let uri = `nostrconnect://${pubkey}?`;
    NIP46_RELAYS.forEach(r => {
        uri += `relay=${encodeURIComponent(r)}&`;
    });
    uri += `secret=${encodeURIComponent(secret)}&name=${encodeURIComponent('SatLotto')}&url=${encodeURIComponent('https://satlotto.com')}`;

    return { uri, secret, signer, pubkey };
}

export async function createBunkerSession(
    bunkerUrl: string,
    signer: NDKPrivateKeySigner,
    secret: string
): Promise<{ session: BunkerSession; signer: NDKNip46Signer }> {
    const ndkInstance = new NDK({ explicitRelayUrls: NIP46_RELAYS });
    await ndkInstance.connect(5000);

    const localPubkey = signer.pubkey;
    const localPrivkey = (signer as any)._privateKey;

    console.log('[NIP-46] Iniciando handshake...');
    console.log('[NIP-46] Local pubkey:', localPubkey);
    console.log('[NIP-46] Esperando secreto:', secret);

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            console.log('[NIP-46] TIMEOUT - No se recibió respuesta en 60s');
            reject(new Error('Timeout esperando respuesta del bunker (60s)'));
        }, 60000);

        const sub = ndkInstance.subscribe(
            { kinds: [24133], '#p': [localPubkey] },
            { closeOnEose: false }
        );

        console.log('[NIP-46] Suscrito a kind 24133, esperando eventos...');

        sub.on('event', async (event: NDKEvent) => {
            console.log('[NIP-46] ██ Evento recibido de:', event.pubkey.slice(0, 8));

            try {
                const privKeyBytes = typeof localPrivkey === 'string'
                    ? new Uint8Array(localPrivkey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
                    : localPrivkey;

                const conversationKey = nip44.v2.utils.getConversationKey(privKeyBytes, event.pubkey);
                const decrypted = nip44.v2.decrypt(event.content, conversationKey);
                const data = JSON.parse(decrypted);

                console.log('[NIP-46] ██ Contenido descifrado:', JSON.stringify(data));

                if (data.result === secret) {
                    console.log('[NIP-46] ██ SECRET COINCIDE! Handshake exitoso!');
                    clearTimeout(timeout);

                    const bunkerSigner = new NDKNip46Signer(ndkInstance, event.pubkey, signer);
                    (bunkerSigner as any).remotePubkey = event.pubkey;

                    const session: BunkerSession = {
                        bunkerTarget: bunkerUrl,
                        localSignerPrivkey: localPrivkey,
                        remotePubkey: event.pubkey,
                    };

                    resolve({ session, signer: bunkerSigner });
                } else {
                    console.log('[NIP-46] ██ Secret no coincide:', data.result, 'vs', secret);
                }
            } catch (e: any) {
                console.log('[NIP-46] ██ Error al descifrar:', e.message);
            }
        });

        sub.on('eose', () => {
            console.log('[NIP-46] EOSE recibido');
        });

        setTimeout(() => {
            clearTimeout(timeout);
            reject(new Error('No se recibió respuesta del bunker'));
        }, 65000);
    });
}

export function restoreBunkerSession(session: BunkerSession): NDKNip46Signer {
    const ndkInstance = new NDK({ explicitRelayUrls: NIP46_RELAYS });
    const signer = new NDKPrivateKeySigner(session.localSignerPrivkey);
    return new NDKNip46Signer(ndkInstance, session.remotePubkey, signer);
}

export function serializeSession(session: BunkerSession): string {
    return JSON.stringify(session);
}

export function deserializeSession(data: string): BunkerSession {
    return JSON.parse(data);
}
