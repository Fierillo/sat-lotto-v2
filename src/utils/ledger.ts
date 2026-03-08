import { authState } from '../components/auth';
import { finalizeEvent } from 'nostr-tools';
import ndk, { getAlias } from './nostr';
import { NDKEvent } from '@nostr-dev-kit/ndk';

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function submitBet(targetBlock: number, selectedNumber: number): Promise<{ paymentRequest: string; paymentHash: string } | null> {
    if (!authState.pubkey) throw new Error('No estás logueado');

    const unsignedNostrEvent = {
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

    localStorage.setItem('satlotto_pending_bet', JSON.stringify({ targetBlock, selectedNumber }));

    let signedNostrEvent;
    const windowNostrExtension = (window as any).nostr;

    if (authState.signer) {
        const ndkEvent = new NDKEvent(ndk, unsignedNostrEvent);
        await ndkEvent.sign(authState.signer);
        signedNostrEvent = ndkEvent.rawEvent();
    } else if (windowNostrExtension) {
        signedNostrEvent = await windowNostrExtension.signEvent(unsignedNostrEvent);
    } else if (authState.nwcUrl) {
        const nwcUrlObject = new URL(authState.nwcUrl.replace('nostr+walletconnect:', 'http:'));
        const secretKeyHex = nwcUrlObject.searchParams.get('secret');
        if (!secretKeyHex) throw new Error('NWC URL no contiene secret para firmar');
        const secretKeyBytes = Uint8Array.from(secretKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        signedNostrEvent = finalizeEvent(unsignedNostrEvent, secretKeyBytes);
    }

    const apiPayload = signedNostrEvent ? { signedEvent: signedNostrEvent } : {
        pubkey: authState.pubkey,
        bet: { bloque: targetBlock, numero: selectedNumber },
        alias: getAlias(authState.pubkey)
    };

    const apiResponse = await fetch(`${API_BASE}/api/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload)
    });

    const responseContent = await apiResponse.json();
    if (!apiResponse.ok) throw new Error(responseContent.error || 'Error del servidor');

    return { paymentRequest: responseContent.paymentRequest, paymentHash: responseContent.paymentHash };
}

export async function confirmBet(paymentHash: string): Promise<void> {
    const apiResponse = await fetch(`${API_BASE}/api/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentHash })
    });
    if (!apiResponse.ok) {
        const responseError = await apiResponse.json();
        throw new Error(responseError.error || 'No se pudo confirmar el pago');
    }
}

export async function fetchBets(targetBlock: number): Promise<Array<{ pubkey: string; selected_number: number; alias?: string }>> {
    try {
        const apiResponse = await fetch(`${API_BASE}/api/bets?block=${targetBlock}`);
        if (!apiResponse.ok) return [];
        const parsedBets = await apiResponse.json();
        return parsedBets.bets || [];
    } catch {
        return [];
    }
}

export async function fetchResult(targetBlock: number) {
    try {
        const apiResponse = await fetch(`${API_BASE}/api/result?block=${targetBlock}`);
        if (!apiResponse.ok) return null;
        return apiResponse.json();
    } catch {
        return null;
    }
}

export async function fetchPoolBalance(): Promise<number> {
    try {
        const apiResponse = await fetch(`${API_BASE}/api/pool`);
        if (!apiResponse.ok) return 0;
        const balanceData = await apiResponse.json();
        return balanceData.balance || 0;
    } catch {
        return 0;
    }
}
export async function fetchIdentity(pubkey: string): Promise<string | null> {
    try {
        const apiResponse = await fetch(`${API_BASE}/api/identity/${pubkey}`);
        if (!apiResponse.ok) return null;
        const identityData = await apiResponse.json();
        return identityData.alias || null;
    } catch {
        return null;
    }
}
