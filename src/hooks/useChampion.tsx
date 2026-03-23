'use client';

import { useState, useCallback, ReactElement } from 'react';
import { ChampionModal } from '../components/modals/ChampionModal';
import { PotentialWinnerModal } from '../components/modals/PotentialWinnerModal';

interface ChampionParams {
    satsWon?: number;
    pubkey?: string;
    blockHeight: number;
    winningNumber?: number;
}

interface ChampionData {
    satsWon: number;
    lud16?: string | null;
    pubkey?: string;
    blockHeight: number;
    winningNumber?: number;
}

interface UseChampionReturn {
    triggerPotentialWinner: (params: ChampionParams) => void;
    triggerChampion: (params: ChampionParams) => void;
    PotentialWinnerModal: ReactElement | null;
    ChampionModal: ReactElement | null;
}

export function useChampion(): UseChampionReturn {
    const [showPotentialModal, setShowPotentialModal] = useState(false);
    const [showChampionModal, setShowChampionModal] = useState(false);
    const [potentialData, setPotentialData] = useState<ChampionData | null>(null);
    const [championData, setChampionData] = useState<ChampionData | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    const fetchLud16 = useCallback(async (pubkey: string): Promise<string | null> => {
        const localLud16 = localStorage.getItem('satlotto_lud16');
        if (localLud16) return localLud16;

        const localAlias = localStorage.getItem('satlotto_alias');
        if (localAlias) return localAlias;

        try {
            const res = await fetch(`/api/identity/${pubkey}`);
            const data = await res.json();
            return data.lud16 || null;
        } catch {
            return null;
        }
    }, []);

    const cleanupAnimation = useCallback(() => {
        document.body.classList.remove('celebrating');
        const clock = document.getElementById('clock');
        if (clock) clock.classList.remove('victory-mode');
        document.querySelectorAll('.winner-overlay, .victory-text-animation').forEach(el => el.remove());
    }, []);

    const triggerPotentialWinner = useCallback((params: ChampionParams) => {
        if (isAnimating) return;

        cleanupAnimation();

        const data: ChampionData = {
            satsWon: 0,
            pubkey: params.pubkey,
            blockHeight: params.blockHeight,
            winningNumber: params.winningNumber,
        };
        setPotentialData(data);
        setShowPotentialModal(true);

        if (params.pubkey) {
            fetchLud16(params.pubkey).then(lud16 => {
                setPotentialData(prev => prev ? { ...prev, lud16 } : null);
            });
        }
    }, [isAnimating, cleanupAnimation, fetchLud16]);

    const triggerChampion = useCallback((params: ChampionParams) => {
        if (isAnimating) return;
        setIsAnimating(true);

        cleanupAnimation();

        const data: ChampionData = {
            satsWon: params.satsWon || 0,
            pubkey: params.pubkey,
            blockHeight: params.blockHeight,
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
                const lud16 = await fetchLud16(params.pubkey);
                setChampionData(prev => prev ? { ...prev, lud16 } : null);
            }
            setShowChampionModal(true);
            setIsAnimating(false);
        }, 5500);
    }, [isAnimating, cleanupAnimation, fetchLud16]);

    const handlePotentialClose = useCallback(() => {
        setShowPotentialModal(false);
    }, []);

    const PotentialWinnerModalComponent = potentialData ? (
        <PotentialWinnerModal
            isOpen={showPotentialModal}
            onClose={handlePotentialClose}
            blockHeight={potentialData.blockHeight}
            winningNumber={potentialData.winningNumber}
            lud16={potentialData.lud16}
            pubkey={potentialData.pubkey}
        />
    ) : null;

    const ChampionModalComponent = championData ? (
        <ChampionModal
            isOpen={showChampionModal}
            onClose={() => setShowChampionModal(false)}
            satsWon={championData.satsWon}
            lud16={championData.lud16}
            pubkey={championData.pubkey}
            blockHeight={championData.blockHeight}
        />
    ) : null;

    return {
        triggerPotentialWinner,
        triggerChampion,
        PotentialWinnerModal: PotentialWinnerModalComponent,
        ChampionModal: ChampionModalComponent,
    };
}