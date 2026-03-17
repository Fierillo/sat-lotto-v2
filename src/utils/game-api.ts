import { authState } from '../auth/auth-state';
import { finalizeEvent } from 'nostr-tools';
import ndk, { getAlias } from './nostr-service';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { apiClient } from './api-client';
import { Bet, SorteoResult } from '../types';

export async function submitBet(targetBlock: number, selectedNumber: number): Promise<{ paymentRequest: string; paymentHash: string } | null> {
    if (!authState.pubkey) throw new Error('No estás logueado');

    const unsigned = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'satlotto']],
        content: JSON.stringify({
            bloque: targetBlock,
            numero: selectedNumber,
            alias: authState.nip05 || getAlias(authState.pubkey)
        }),
        pubkey: authState.pubkey
    };

    let signed: any = null;
    const ext = (window as any).nostr;

    if (authState.signer) {
        try {
            const ev = new NDKEvent(ndk, unsigned);
            console.log('[submitBet] Firmar con signer...');

            const signPromise = ev.sign(authState.signer);
            const timeout = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout esperando firma')), 15000));
            const signature = await Promise.race([signPromise, timeout]);

            ev.sig = signature;
            signed = ev.rawEvent();

            if (!signed.sig) throw new Error('Firma vacía');
            console.log('[submitBet] Firmado OK, id:', signed.id?.substring(0, 12));
        } catch (e: any) {
            console.error('[submitBet] Signer falló:', e.message || e);
        }
    }

    if (!signed && ext) {
        try {
            console.log('[submitBet] Fallback: extensión...');
            signed = await ext.signEvent(unsigned);
            console.log('[submitBet] Ext firmada OK, id:', signed.id?.substring(0, 12));
        } catch (e) {
            console.error('[submitBet] Ext falló:', e);
        }
    }

    if (!signed && authState.nwcUrl) {
        try {
            const url = new URL(authState.nwcUrl.replace('nostr+walletconnect:', 'http:'));
            const secret = url.searchParams.get('secret');
            if (secret) {
                console.log('[submitBet] Fallback: NWC secret...');
                const bytes = Uint8Array.from(secret.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
                signed = finalizeEvent(unsigned, bytes);
                console.log('[submitBet] NWC firmada OK, id:', signed.id?.substring(0, 12));
            }
        } catch (e) {
            console.error('[submitBet] NWC falló:', e);
        }
    }

    if (!signed) throw new Error('No se pudo firmar. Verificá tu conexión.');

    const payload = { signedEvent: signed };
    return apiClient.post<{ paymentRequest: string; paymentHash: string }>('/api/bet', payload);
}

export const confirmBet = (paymentHash: string) => apiClient.post('/api/bet', { paymentHash, action: 'confirm' });

export interface GameStateResponse {
    block: { height: number; target: number; poolBalance: number };
    activeBets: Bet[];
    champions: any[];
    lastResult: SorteoResult | null;
}

export const fetchGameState = () => apiClient.get<GameStateResponse>('/api/state');

export const fetchIdentity = (pubkey: string) => apiClient.get<{ alias: string | null; sats_earned: number }>(`/api/identity/${pubkey}`).catch(() => null);

export const verifyIdentity = (pubkey: string, event: any, blockHeight?: number, lud16?: string) => 
    apiClient.post<{ ok: boolean; alias: string }>(`/api/identity/${pubkey}`, { event, blockHeight, lud16 });

