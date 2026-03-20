'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { apiClient } from '../utils/api-client';
import ndk, { resolveAlias } from '../utils/nostr-service';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { finalizeEvent } from 'nostr-tools';
import { NIP07 } from '../lib/nip07';
import { NWC } from '../lib/nwc';
import type { Bet, SignedEvent } from '../types';

export type PaymentStatus = 'idle' | 'generating' | 'signing' | 'paying' | 'success' | 'error';

interface PaymentResult {
    paymentRequest: string;
    paymentHash: string;
}

interface UsePaymentReturn {
    paymentStatus: PaymentStatus;
    paymentError: string | null;
    makePayment: () => Promise<PaymentResult | void>;
    confirmBet: (paymentHash: string) => Promise<any>;
    resetPaymentStatus: () => void;
}

export function usePayment(): UsePaymentReturn {
    const { state: authState } = useAuth();
    const { state: gameState, selectNumber, refreshGame } = useGame();
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
    const [paymentError, setPaymentError] = useState<string | null>(null);

    const submitBet = useCallback(async (targetBlock: number, selectedNumber: number) => {
        if (!authState.pubkey) throw new Error('No estás logueado');

        const alias = authState.nip05 || await resolveAlias(authState.pubkey);

        const unsigned = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({
                bloque: targetBlock,
                numero: selectedNumber,
                alias,
            }),
            pubkey: authState.pubkey,
        };

        let signed: SignedEvent | null = null;
        const ext = window.nostr;

        if (authState.signer) {
            try {
                const ev = new NDKEvent(ndk, unsigned);
                const signPromise = ev.sign(authState.signer);
                const timeout = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout esperando firma')), 15000)
                );
                const signature = await Promise.race([signPromise, timeout]);
                ev.sig = signature;
                signed = ev.rawEvent();
                if (!signed.sig) throw new Error('Firma vacía');
            } catch (e: any) {
                console.error('[submitBet] Signer falló:', e.message || e);
            }
        }

        if (!signed && ext) {
            try {
                signed = await ext.signEvent(unsigned);
            } catch (e) {
                console.error('[submitBet] Ext falló:', e);
            }
        }

        if (!signed && authState.nwcUrl) {
            try {
                const url = new URL(authState.nwcUrl.replace('nostr+walletconnect:', 'http:'));
                const secret = url.searchParams.get('secret');
                if (secret) {
                    const bytes = Uint8Array.from(secret.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
                    signed = finalizeEvent(unsigned, bytes);
                }
            } catch (e) {
                console.error('[submitBet] NWC falló:', e);
            }
        }

        if (!signed) throw new Error('No se pudo firmar. Verificá tu conexión.');

        return apiClient.post<{ paymentRequest: string; paymentHash: string }>('/api/bet', { signedEvent: signed });
    }, [authState]);

    const confirmBetHandler = useCallback((paymentHash: string) => {
        return apiClient.post('/api/bet', { paymentHash, action: 'confirm' });
    }, []);

    const resetPaymentStatus = useCallback(() => {
        setPaymentStatus('idle');
        setPaymentError(null);
    }, []);

    const makePayment = useCallback(async () => {
        if (gameState.selectedNumber === null) return;
        if (!authState.pubkey) {
            setPaymentError('No estás logueado');
            return;
        }

        setPaymentStatus('generating');
        setPaymentError(null);

        try {
            await refreshGame();

            if (authState.loginMethod === 'amber') {
                const result = await fetch(
                    `/api/bet?block=${gameState.targetBlock}&number=${gameState.selectedNumber}&pubkey=${authState.pubkey}`
                );
                if (!result.ok) throw new Error('No se pudo generar la invoice');
                const { paymentRequest, paymentHash } = await result.json();
                setPaymentStatus('paying');
                return { paymentRequest, paymentHash };
            }

            setPaymentStatus('signing');
            const result = await submitBet(gameState.targetBlock, gameState.selectedNumber);
            if (!result) throw new Error('No response from server');

            const { paymentRequest, paymentHash } = result;
            setPaymentStatus('paying');

            if (authState.loginMethod === 'nwc') {
                try {
                    await NWC.payInvoice(paymentRequest, authState.nwcUrl!);
                    await confirmBetHandler(paymentHash);
                    await refreshGame();
                    setPaymentStatus('success');
                    selectNumber(null);
                    setTimeout(resetPaymentStatus, 4000);
                    return;
                } catch (err: any) {
                    setPaymentError(err.message || 'Error en el pago con NWC');
                    setPaymentStatus('error');
                    return;
                }
            }

            if (authState.loginMethod === 'extension') {
                try {
                    await NIP07.payInvoice(paymentRequest);
                    await confirmBetHandler(paymentHash);
                    await refreshGame();
                    setPaymentStatus('success');
                    selectNumber(null);
                    setTimeout(resetPaymentStatus, 4000);
                    return;
                } catch (err: any) {
                    setPaymentError(err.message || 'Error en el pago con extensión');
                    setPaymentStatus('error');
                    return;
                }
            }

            return { paymentRequest, paymentHash };
        } catch (e: any) {
            console.error('[makePayment] Error:', e);
            setPaymentError(e.message);
            setPaymentStatus('error');
        }
    }, [authState, gameState, refreshGame, selectNumber, submitBet, confirmBetHandler]);

    return {
        paymentStatus,
        paymentError,
        makePayment,
        confirmBet: confirmBetHandler,
        resetPaymentStatus,
    };
}
