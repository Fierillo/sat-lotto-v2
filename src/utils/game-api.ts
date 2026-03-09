import { authState } from '../auth/auth-state';
import { finalizeEvent } from 'nostr-tools';
import ndk, { getAlias } from './nostr-service';
import { NDKEvent, NDKNip46Signer } from '@nostr-dev-kit/ndk';
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

    let signed;
    const ext = (window as any).nostr;

    if (authState.signer && !(authState.signer instanceof NDKNip46Signer)) {
        const ev = new NDKEvent(ndk, unsigned);
        await ev.sign(authState.signer);
        signed = ev.rawEvent();
    } else if (ext) {
        signed = await ext.signEvent(unsigned);
    } else if (authState.nwcUrl) {
        const url = new URL(authState.nwcUrl.replace('nostr+walletconnect:', 'http:'));
        const secret = url.searchParams.get('secret');
        if (!secret) throw new Error('NWC lacks secret');
        const bytes = Uint8Array.from(secret.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
        signed = finalizeEvent(unsigned, bytes);
    }

    const payload = signed ? { signedEvent: signed } : {
        pubkey: authState.pubkey,
        bet: { bloque: targetBlock, numero: selectedNumber },
        alias: authState.nip05 || getAlias(authState.pubkey)
    };

    return apiClient.post<{ paymentRequest: string; paymentHash: string }>('/api/bet', payload);
}

export const confirmBet = (paymentHash: string) => apiClient.post('/api/confirm', { paymentHash });
export const fetchBets = (block: number) => apiClient.get<{ bets: Bet[] }>(`/api/bets?block=${block}`).then(r => r.bets || []);
export const fetchResult = (block: number) => apiClient.get<SorteoResult>(`/api/result?block=${block}`).catch(() => null);
export const fetchIdentity = (pubkey: string) => apiClient.get<{ alias: string | null }>(`/api/identity/${pubkey}`).then(r => r.alias).catch(() => null);
