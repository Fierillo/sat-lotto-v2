'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { apiClient } from '../utils/api-client';
import ndk from '../lib/ndk';
import { NDKEvent, NDKSigner } from '@nostr-dev-kit/ndk';
import { finalizeEvent } from 'nostr-tools';
import { NIP07 } from '../lib/nip07';
import { NWC } from '../lib/nwc';
import { deserializeSession } from '@/src/lib/nip46';
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

        const unsigned = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({
                bloque: targetBlock,
                numero: selectedNumber,
                alias: authState.nip05,
            }),
            pubkey: authState.pubkey,
        };

        let signed: SignedEvent | null = null;

        if (authState.signer && authState.signer === window.nostr) {
            try {
                signed = await NIP07.signEvent(unsigned);
            } catch (e) {
                console.error('[submitBet] Ext falló:', e);
            }
        } else if (authState.signer) {
            try {
                const ev = new NDKEvent(ndk, unsigned);
                const signPromise = ev.sign(authState.signer as NDKSigner);
                const timeout = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout esperando firma')), 15000)
                );
                const signature = await Promise.race([signPromise, timeout]);
                ev.sig = signature;
                signed = ev.rawEvent();
                if (!signed.sig) throw new Error('Firma vacía');
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'Signer error';
                console.error('[submitBet] Signer falló:', msg);
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

        if (!signed && authState.bunkerSession) {
            try {
                const session = deserializeSession(authState.bunkerSession);
                const bytes = Uint8Array.from(session.localSignerPrivkey.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
                signed = finalizeEvent(unsigned, bytes);
            } catch (e) {
                console.error('[submitBet] Bunker falló:', e);
            }
        }

        if (!signed) throw new Error('No se pudo firmar. Verificá tu conexión.');

        return apiClient.post<{ paymentRequest: string; paymentHash: string }>('/api/bet', { signedEvent: signed });
    }, [authState]);

    const resetPaymentStatus = useCallback(() => {
        setPaymentStatus('idle');
        setPaymentError(null);
    }, []);

    const confirmBetHandler = useCallback(async (paymentHash: string) => {
        await apiClient.post('/api/bet', { paymentHash, action: 'confirm' });
        await refreshGame();
        setPaymentStatus('success');
        selectNumber(null);
        setTimeout(resetPaymentStatus, 4000);
    }, [refreshGame, resetPaymentStatus]);

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

            let paymentRequest: string;
            let paymentHash: string;

            if (authState.loginMethod === 'amber') {
                const result = await fetch(
                    `/api/bet?block=${gameState.targetBlock}&number=${gameState.selectedNumber}&pubkey=${authState.pubkey}`
                );
                if (!result.ok) throw new Error('No se pudo generar la invoice');
                const data = await result.json();
                paymentRequest = data.paymentRequest;
                paymentHash = data.paymentHash;
            } else {
                setPaymentStatus('signing');
                const result = await submitBet(gameState.targetBlock, gameState.selectedNumber);
                if (!result) throw new Error('No response from server');
                paymentRequest = result.paymentRequest;
                paymentHash = result.paymentHash;
            }

            const needsManualPayment = 
                authState.loginMethod === 'bunker' ||
                (authState.loginMethod === 'extension' && !NIP07.canPay);

            if (needsManualPayment) {
                setPaymentStatus('paying');
                return { paymentRequest, paymentHash };
            }

            if (authState.loginMethod === 'nwc') {
                await NWC.payInvoice(paymentRequest, authState.nwcUrl!);
            } else if (authState.loginMethod === 'extension') {
                await NIP07.payInvoice(paymentRequest);
            }

            setPaymentStatus('paying');
            await confirmBetHandler(paymentHash);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error interno';
            console.error('[makePayment] Error:', msg);
            setPaymentError(msg);
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
