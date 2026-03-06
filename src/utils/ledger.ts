import { authState } from '../components/auth';

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function submitBet(targetBlock: number, selectedNumber: number): Promise<string> {
    if (!authState.pubkey) throw new Error('No estás logueado');

    const eventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'satlotto']],
        content: JSON.stringify({ bloque: targetBlock, numero: selectedNumber }),
        pubkey: authState.pubkey
    };

    const nostr = (window as any).nostr;
    if (!nostr) throw new Error('Se necesita extensión Nostr para firmar la apuesta');

    const signedEvent = await nostr.signEvent(eventTemplate);

    const resp = await fetch(`${API_BASE}/api/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedEvent })
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Error del servidor');

    return data.paymentRequest;
}

export async function fetchBets(targetBlock: number): Promise<Array<{ pubkey: string; selected_number: number }>> {
    try {
        const resp = await fetch(`${API_BASE}/api/bets?block=${targetBlock}`);
        if (!resp.ok) return [];
        return resp.json();
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
