'use client';

import { useState, useCallback, ReactElement } from 'react';
import { ChampionModal } from '../components/modals/ChampionModal';
import { PotentialWinnerModal } from '../components/modals/PotentialWinnerModal';
import ndk from '../lib/ndk';
import { NDKEvent, NDKSigner } from '@nostr-dev-kit/ndk';
import { createNwcInvoice } from '../lib/nwc';
import { useAuth } from '../contexts/AuthContext';

interface ChampionParams {
    pubkey?: string;
    blockHeight: number;
    winningNumber?: number;
    onClose?: () => void;
}

interface ChampionData {
    lud16?: string | null;
    pubkey?: string;
    blockHeight: number;
    winningNumber?: number;
    sats_pending?: number;
    onClose?: () => void;
    onSaveLN?: (lud16: string) => Promise<{ error?: string }>;
    onClaim?: () => Promise<{ claimed: number; error?: string }>;
}

interface UseChampionReturn {
    triggerPotentialWinner: (params: ChampionParams) => void;
    triggerChampion: (params: ChampionParams) => void;
    isAnimating: boolean;
    PotentialWinnerModal: ReactElement | null;
    ChampionModal: ReactElement | null;
}

export function useChampion(signer?: any, loginMethod?: string | null): UseChampionReturn {
    const auth = useAuth();
    const [showPotentialModal, setShowPotentialModal] = useState(false);
    const [showChampionModal, setShowChampionModal] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinError, setPinError] = useState<string | null>(null);
    const [pinAttemptsLeft, setPinAttemptsLeft] = useState<number>(3);
    const [pendingClaimPubkey, setPendingClaimPubkey] = useState<string | null>(null);
    const [potentialData, setPotentialData] = useState<ChampionData | null>(null);
    const [championData, setChampionData] = useState<ChampionData | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    const fetchIdentityData = useCallback(async (pubkey: string) => {
        const localLud16 = localStorage.getItem('satlotto_lud16');

        try {
            const res = await fetch(`/api/identity/${pubkey}`);
            const data = await res.json();
            return {
                lud16: localLud16 || data.lud16 || null,
                sats_pending: data.sats_pending || 0
            };
        } catch {
            return { lud16: localLud16 || null, sats_pending: 0 };
        }
    }, []);

    const signEvent = useCallback(async (event: { kind: number; created_at: number; tags: string[][]; content: string; pubkey: string }): Promise<{ sig: string; id: string } | null> => {
        if (!signer) return null;

        if (signer === window.nostr) {
            try {
                return await (signer as any).signEvent(event);
            } catch {
                return null;
            }
        }

        try {
            const ndkEvent = new NDKEvent(ndk, event);
            const signPromise = ndkEvent.sign(signer as NDKSigner);
            const timeout = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 15000)
            );
            await Promise.race([signPromise, timeout]);
            return ndkEvent.rawEvent();
        } catch {
            return null;
        }
    }, [signer]);

    const cleanupAnimation = useCallback(() => {
        document.body.classList.remove('celebrating');
        const clock = document.getElementById('clock');
        if (clock) clock.classList.remove('victory-mode');
        document.querySelectorAll('.winner-overlay, .victory-text-animation').forEach(el => el.remove());
    }, []);

    const handleChampionClose = useCallback(() => {
        setShowChampionModal(false);
        if (championData?.onClose) {
            championData.onClose();
        }
        setChampionData(null);
    }, [championData]);

    const triggerPotentialWinner = useCallback((params: ChampionParams) => {
        if (isAnimating) return;

        cleanupAnimation();

        const data: ChampionData = {
            pubkey: params.pubkey,
            blockHeight: params.blockHeight,
            winningNumber: params.winningNumber,
        };
        setPotentialData(data);
        setShowPotentialModal(true);

        if (params.pubkey) {
            fetchIdentityData(params.pubkey).then(({ lud16 }) => {
                setPotentialData(prev => prev ? { ...prev, lud16 } : null);
            });
        }
    }, [isAnimating, cleanupAnimation, fetchIdentityData]);

    const triggerChampion = useCallback((params: ChampionParams) => {
        if (isAnimating) return;
        setIsAnimating(true);

        cleanupAnimation();

        const data: ChampionData = {
            pubkey: params.pubkey,
            blockHeight: params.blockHeight,
            onClose: params.onClose,
        };
        setChampionData(data);
        setShowChampionModal(false);

        document.body.classList.add('celebrating');
        const clock = document.getElementById('clock');
        if (clock) clock.classList.add('victory-mode');

        const overlay = document.createElement('div');
        overlay.className = 'winner-overlay';
        document.body.appendChild(overlay);

        const msg = document.createElement('div');
        msg.className = 'victory-text-animation';
        msg.textContent = '¡CAMPEÓN!';
        document.body.appendChild(msg);

        setTimeout(() => {
            cleanupAnimation();
        }, 4500);

        setTimeout(async () => {
            if (params.pubkey) {
                const { lud16, sats_pending } = await fetchIdentityData(params.pubkey);
                setChampionData(prev => prev ? { ...prev, lud16, sats_pending } : null);
            }
            setShowChampionModal(true);
            setIsAnimating(false);
        }, 5500);
    }, [isAnimating, cleanupAnimation, fetchIdentityData]);

    const handlePotentialClose = useCallback(() => {
        setShowPotentialModal(false);
    }, []);

    const PotentialWinnerModalComponent = potentialData && potentialData.pubkey ? (
        <PotentialWinnerModal
            isOpen={showPotentialModal}
            onClose={handlePotentialClose}
            blockHeight={potentialData.blockHeight}
            winningNumber={potentialData.winningNumber}
            lud16={potentialData.lud16}
            pubkey={potentialData.pubkey}
            onSaveLN={(lud16: string) => handleSaveLN(potentialData.pubkey!, lud16)}
        />
    ) : null;

    const handleClaim = useCallback(async (pubkey: string): Promise<{ claimed: number; error?: string }> => {
        if (!pubkey) return { claimed: 0, error: 'No pubkey' };

        const isNwcUser = loginMethod === 'nwc';
        const isExtensionOrBunker = loginMethod === 'extension' || loginMethod === 'bunker';

        if (isExtensionOrBunker) {
            try {
                const signedEvent = await signEvent({
                    kind: 1,
                    created_at: Math.floor(Date.now() / 1000),
                    tags: [['p', pubkey]],
                    content: `Claim prize for ${pubkey}`,
                    pubkey
                });

                if (!signedEvent) {
                    return { claimed: 0, error: 'Firma requerida' };
                }

                const res = await fetch(`/api/identity/${pubkey}/claim`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ signedEvent })
                });
                const data = await res.json();
                if (!res.ok) {
                    return { claimed: 0, error: data.error };
                }
                return { claimed: data.claimed };
            } catch {
                return { claimed: 0, error: 'Network error' };
            }
        }

        if (isNwcUser) {
            const claimCallback = async () => {
                if (!pubkey) return { claimed: 0, error: 'No pubkey' };
                
                const nwcUrl = auth.state.nwcUrl;
                if (!nwcUrl) {
                    return { claimed: 0, error: 'No hay wallet conectada' };
                }

                try {
                    const identityRes = await fetch(`/api/identity/${pubkey}`);
                    const identityData = await identityRes.json();
                    const satsPending = identityData.sats_pending || 0;

                    if (satsPending <= 0) {
                        return { claimed: 0, error: 'No hay premio pendiente' };
                    }

                    const invoiceData = await createNwcInvoice(nwcUrl, satsPending, `SatLotto Prize - Block ${identityData.winner_block}`);
                    const invoice = invoiceData.invoice;

                    const res = await fetch(`/api/identity/${pubkey}/claim`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ invoice })
                    });
                    const data = await res.json();

                    if (!res.ok) {
                        return { claimed: 0, error: data.error };
                    }
                    return { claimed: data.claimed };
                } catch (err) {
                    return { claimed: 0, error: 'Error al generar invoice' };
                }
            };
            
            auth.openPinModal({ mode: 'verify', callback: claimCallback });
            return { claimed: 0, error: 'pending' };
        }

        return { claimed: 0, error: 'Método de autenticación no soportado' };
    }, [loginMethod, signEvent, auth]);

    const handleSaveLN = useCallback(async (pubkey: string, lud16: string): Promise<{ error?: string }> => {
        if (!pubkey) return { error: 'No pubkey' };

        try {
            const signedEvent = await signEvent({
                kind: 0,
                created_at: Math.floor(Date.now() / 1000),
                tags: [],
                content: JSON.stringify({ lud16 }),
                pubkey
            });

            if (!signedEvent) {
                return { error: 'Firma requerida' };
            }

            const res = await fetch(`/api/identity/${pubkey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: signedEvent, lud16 })
            });
            const data = await res.json();
            if (!res.ok) {
                return { error: data.error };
            }
            return {};
        } catch {
            return { error: 'Network error' };
        }
    }, [signEvent]);

    const ChampionModalComponent = championData && championData.pubkey ? (
        <ChampionModal
            isOpen={showChampionModal}
            onClose={handleChampionClose}
            lud16={championData.lud16}
            pubkey={championData.pubkey}
            blockHeight={championData.blockHeight}
            sats_pending={championData.sats_pending}
            onSaveLN={(lud16: string) => handleSaveLN(championData.pubkey!, lud16)}
            onClaim={() => handleClaim(championData.pubkey!)}
            openPinModal={auth.openPinModal}
            showPinInput={loginMethod === 'nwc'}
            isNwcUser={loginMethod === 'nwc'}
        />
    ) : null;

    return {
        triggerPotentialWinner,
        triggerChampion,
        isAnimating,
        PotentialWinnerModal: PotentialWinnerModalComponent,
        ChampionModal: ChampionModalComponent,
    };
}