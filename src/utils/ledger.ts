import { authState } from '../components/auth';
import { finalizeEvent } from 'nostr-tools';
import ndk, { getAlias } from './nostr';
import { NDKEvent } from '@nostr-dev-kit/ndk';

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function submitBet(targetBlock: number, selectedNumber: number): Promise<{ paymentRequest: string; paymentHash: string }> {
    if (!authState.pubkey) throw new Error('No estás logueado');

    const eventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'satlotto']],
        content: JSON.stringify({
            bloque: targetBlock,
            numero: selectedNumber,
            alias: getAlias(authState.pubkey)
        }),
        pubkey: authState.pubkey
    };

    let signedEvent;
    const nostr = (window as any).nostr;

    if (authState.signer) {
        const e = new NDKEvent(ndk, eventTemplate);
        await e.sign(authState.signer);
        signedEvent = e.rawEvent();
    } else if (nostr) {
        signedEvent = await nostr.signEvent(eventTemplate);
    } else if (authState.nwcUrl) {
        const url = new URL(authState.nwcUrl.replace('nostr+walletconnect:', 'http:'));
        const secret = url.searchParams.get('secret');
        if (!secret) throw new Error('NWC URL no contiene secret para firmar');
        const privkey = Uint8Array.from(secret.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        signedEvent = finalizeEvent(eventTemplate, privkey);
    } else {
        throw new Error('Se necesita extensión Nostr, Bunker o NWC para firmar la apuesta');
    }

    const resp = await fetch(`${API_BASE}/api/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedEvent })
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Error del servidor');

    return { paymentRequest: data.paymentRequest, paymentHash: data.paymentHash };
}

export async function confirmBet(paymentHash: string): Promise<void> {
    const resp = await fetch(`${API_BASE}/api/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentHash })
    });
    if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || 'No se pudo confirmar el pago');
    }
}

export async function fetchBets(targetBlock: number): Promise<Array<{ pubkey: string; selected_number: number; alias?: string }>> {
    try {
        const resp = await fetch(`${API_BASE}/api/bets?block=${targetBlock}`);
        if (!resp.ok) return [];
        const data = await resp.json();
        return data.bets || [];
    } catch {
        return [];
    }
}

export async function fetchResult(targetBlock: number) {
    try {
        const resp = await fetch(`${API_BASE}/api/result?block=${targetBlock}`);
        if (!resp.ok) return null;
        return resp.json();
    } catch {
        return null;
    }
}

export async function fetchPoolBalance(): Promise<number> {
    try {
        const resp = await fetch(`${API_BASE}/api/pool`);
        if (!resp.ok) return 0;
        const data = await resp.json();
        return data.balance || 0;
    } catch {
        return 0;
    }
}
export async function fetchIdentity(pubkey: string): Promise<string | null> {
    try {
        const resp = await fetch(`${API_BASE}/api/identity/${pubkey}`);
        if (!resp.ok) return null;
        const data = await resp.json();
        return data.alias || null;
    } catch {
        return null;
    }
}
