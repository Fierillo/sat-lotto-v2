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

    let signed;
    const ext = (window as any).nostr;

    if (authState.signer) {
        try {
            const ev = new NDKEvent(ndk, unsigned);
            console.log('[submitBet] Requesting signature from signer (Bunker/NWC/Ext)...');
            
            // Timeout de 15s para la firma (especialmente para Bunker que depende de otra app)
            const signPromise = ev.sign(authState.signer);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout esperando firma')), 15000));
            
            await Promise.race([signPromise, timeoutPromise]);
            
            signed = ev.rawEvent();
            console.log('[submitBet] Event signed successfully:', signed.id);
        } catch (e: any) {
            console.error('[submitBet] Signer failed:', e.message || e);
            // Si falla el signer (ej: timeout o cancelado), el código seguirá al fallback de abajo
        }
    } 
    
    // Si el signer falló o no estaba, probamos con la extensión como fallback
    if (!signed && ext) {
        try {
            console.log('[submitBet] Fallback: Requesting signature from window.nostr...');
            signed = await ext.signEvent(unsigned);
        } catch (e) {
            console.error('[submitBet] Extension failed:', e);
        }
    }
    
    // Si todavía no tenemos firma, probamos con NWC (llave privada directa)
    if (!signed && authState.nwcUrl) {
        try {
            const url = new URL(authState.nwcUrl.replace('nostr+walletconnect:', 'http:'));
            const secret = url.searchParams.get('secret');
            if (secret) {
                console.log('[submitBet] Fallback: Signing with NWC secret...');
                const bytes = Uint8Array.from(secret.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
                signed = finalizeEvent(unsigned, bytes);
            }
        } catch (e) {
            console.error('[submitBet] NWC signing failed:', e);
        }
    }

    if (!signed) {
        throw new Error('No se pudo firmar la apuesta. Verificá tu conexión con Alby o Bunker.');
    }

    const payload = { signedEvent: signed };
    return apiClient.post<{ paymentRequest: string; paymentHash: string }>('/api/bet', payload);
}

export const confirmBet = (paymentHash: string) => apiClient.post('/api/confirm', { paymentHash });
export const fetchBets = (block: number) => apiClient.get<{ bets: Bet[] }>(`/api/bets?block=${block}`).then(r => r.bets || []);
export const fetchResult = (block: number) => apiClient.get<SorteoResult>(`/api/result?block=${block}`).catch(() => null);
export const fetchIdentity = (pubkey: string) => apiClient.get<{ alias: string | null }>(`/api/identity/${pubkey}`).then(r => r.alias).catch(() => null);
