import { authState } from '../components/auth';
import { finalizeEvent } from 'nostr-tools';

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function submitBet(targetBlock: number, selectedNumber: number): Promise<string> {
    if (!authState.pubkey) throw new Error('No estás logueado');

    const eventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'satlotto']],
        content: JSON.stringify({
            bloque: targetBlock,
            numero: selectedNumber,
            alias: authState.nip05
        }),
        pubkey: authState.pubkey
    };

    let signedEvent;
    const nostr = (window as any).nostr;

    if (authState.signer) {
        // NDK Signers expect NDKEvent or similar, but many have simple signEvent
        signedEvent = await authState.signer.sign(eventTemplate);
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

    return data.paymentRequest;
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
