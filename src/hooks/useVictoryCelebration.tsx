'use client';

import { useState, ReactElement } from 'react';
import { ChampionModal } from '../components/modals/ChampionModal';

interface ChampionData {
    satsWon: number;
    lud16?: string | null;
    pubkey?: string;
    blockHeight: number;
}

export function useVictoryCelebration(): {
    triggerCelebration: (data: ChampionData) => void;
    ChampionModal: ReactElement | null;
} {
    const [showChampionModal, setShowChampionModal] = useState(false);
    const [championData, setChampionData] = useState<ChampionData | null>(null);

    const triggerCelebration = (data: ChampionData) => {
        if (!data) return;
        
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
            document.body.classList.remove('celebrating');
            if (clock) clock.classList.remove('victory-mode');
            overlay.remove();
            msg.remove();
        }, 4500);
        
        setTimeout(() => {
            setShowChampionModal(true);
        }, 5500);
    };

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

    return { triggerCelebration, ChampionModal: ChampionModalComponent };
}
