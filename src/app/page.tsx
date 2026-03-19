'use client';

import { useState, useCallback, useEffect } from 'react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { GameProvider, useGame } from '../contexts/GameContext';
import { Clock } from '../components/Clock';
import { BetsTable } from '../components/BetsTable';
import { ChampionsTable } from '../components/ChampionsTable';
import { ResultPanel } from '../components/ResultPanel';
import { JackpotPanel } from '../components/JackpotPanel';
import { Modal } from '../components/modals/Modal';
import { LoginModal } from '../components/modals/LoginModal';
import '@/src/globals.css';

function GameContent() {
    const { state: authState } = useAuth();
    const { state: gameState } = useGame();
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const handleShowLogin = useCallback(() => {
        setShowLoginModal(true);
    }, []);

    const handleCloseLogin = useCallback(() => {
        setShowLoginModal(false);
    }, []);

    if (!mounted) return <div id="outerRing"></div>;

    return (
        <div id="app">
            {/* Header */}
            <div className="header">
                <h1><span>SatLotto</span></h1>
                <p className="subtitle">Proba tu suerte, cada 21 bloques</p>
            </div>

            {/* Jackpot Pool */}
            <div id="jackpotPool">
                <JackpotPanel poolBalance={gameState.poolBalance} />
            </div>

            {/* Main Game Container */}
            <div className="game-container">
                <Clock
                    onShowLogin={handleShowLogin}
                    onShowFrozenHelp={() => {}}
                />

                <div id="clockInfo">
                    Bloque: <strong className="text-green">{gameState.currentBlock}</strong> • Sorteo: <strong className="text-orange">{gameState.targetBlock}</strong>
                </div>

                <div id="betsTable" className="bets-panel">
                    <BetsTable bets={gameState.bets} />
                </div>

                <div id="championsTable" className="bets-panel">
                    <ChampionsTable champions={gameState.champions} />
                </div>

                <div id="lastResult" className="result-panel">
                    <ResultPanel lastResult={gameState.lastResult} targetBlock={gameState.targetBlock} />
                </div>
            </div>

            {/* Footer */}
            <div className="footer">
                <div className="footer-content">
                    <div className="footer-info">
                        <a href="https://github.com/fierillo/sat-lotto-v2" target="_blank">SatLotto</a>{' '}
                        fue creado con amor por{' '}
                        <a href="https://github.com/fierillo" target="_blank">Fierillo</a>
                    </div>
                    <div className="powered-by">
                        <span>Powered by</span>
                        <a href="https://lacrypta.ar" target="_blank" className="lacrypta-logo">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 255.18 56.53" width="100" height="22" fill="currentColor">
                                <path d="M11.11,47.57V42.28H45.45v-3.8H18.69V33.19H45.45V29.38H25.25V24.1h20.2V24c0-12.55-10.17-24-22.72-24h0C10.18,0,0,11.48,0,24V52.31H45.45V47.57Z" />
                                <rect x="71.19" y="16.56" width="4.66" height="30.78" />
                                <path d="M81.49,26a22.55,22.55,0,0,1,9.16-2.17c9,0,11.55,4.2,11.55,10.57V47.24H97V45.46c-2.29,1.52-5.82,2.21-9.33,2.21-6.48,0-8.82-3.43-8.82-6.88s3.18-7.74,9.43-7.74A16.59,16.59,0,0,1,97,35.3v-.93C97,30,96.38,28,91,28a19.49,19.49,0,0,0-9.53,2.67ZM96.8,40.35a12.85,12.85,0,0,0-7.8-3c-3.58,0-5,1.8-5,3.44,0,2.22,2.81,3,5.59,2.6a12.54,12.54,0,0,0,7.16-3.11Z" />
                                <path d="M132.87,39A6.12,6.12,0,0,1,127,42.5c-4.72,0-6.39-3.8-6.39-7s1.67-7,6.39-7A6.13,6.13,0,0,1,132.87,32l.25.51,4.81-2.83-.26-.45c-1.47-2.58-4.52-5.66-10.68-5.66-8.47,0-12.33,6.19-12.33,11.93S118.52,47.38,127,47.38c6.16,0,9.21-3.08,10.68-5.66l.26-.45-4.81-2.83Z" />
                                <path d="M153.63,23.52c-2.89,0-5.36,1.89-6.95,3.51V23.94h-6.07v23.4h6.07V32.59c1.86-2,4.29-3.32,6.24-3.32A6.39,6.39,0,0,1,158,31.66l.48.66,3-5V27.2c0-.46-3.21-3.68-7.92-3.68" />
                                <path d="M180.82,37.39c-1.49,2.15-4.28,4.6-7.41,4.6-3.65,0-3.95-3.78-3.95-8V23.94h-6V34c0,9.12,2.79,13.37,8.79,13.37a12.83,12.83,0,0,0,8.55-3.91v3c0,2.24-.95,4.9-5.47,4.91h0a10.81,10.81,0,0,1-7.54-2.75l-.4-.42-3.65,4.13.31.35c.14.16,3.5,3.87,11.42,3.87,9.36,0,11.33-5.48,11.33-10.09V23.94h-6Z" />
                                <path d="M204.32,23.52a13,13,0,0,0-8.55,3.38v-3h-6V56.29h6V43.63c1.43,1.64,3.88,3.75,7,3.75,6.19,0,10.34-6.17,10.34-11.93,0-5.5-2.3-11.93-8.79-11.93m2.9,11.93c0,3.27-1.47,6.76-5.59,6.76-2.52,0-4.57-2.56-5.86-4.75V32.67a9.1,9.1,0,0,1,7.41-4c3.65,0,4,4.72,4,6.75" />
                                <path d="M224.31,15.87l-6,1.89v6.17H214.7v4.88h3.63V38c0,4.62,0,9.39,5.76,9.39,2.42,0,5.36-2.17,5.49-2.26l.25-.19-.58-3.79-.65.35a8.64,8.64,0,0,1-3.11.92c-.16,0-.7,0-1-1.27a16,16,0,0,1-.2-3.15V28.81h6.2V23.93h-6.2Z" />
                                <path d="M243.64,23.66a22.07,22.07,0,0,0-9,2.13l-.3.14v5.8l.81-.52A18.27,18.27,0,0,1,244,28.75c4.75,0,5.22,1.6,5.22,5.53a16.61,16.61,0,0,0-7.8-1.78h0a10,10,0,0,0-7.1,2.61,7.57,7.57,0,0,0-2.42,5.31c0,3.43,2.35,7.09,9,7.09a18.69,18.69,0,0,0,8.37-1.72V47.1h6V34.28c0-7.34-3.56-10.62-11.54-10.62m5,16.31a10.88,10.88,0,0,1-6,2.4,5.72,5.72,0,0,1-4.21-.75,1.52,1.52,0,0,1-.54-1.2c0-1.27,1.1-2.76,4.2-2.76A11.16,11.16,0,0,1,248.59,40" />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>

            {/* Login Modal */}
            <LoginModal isOpen={showLoginModal} onClose={handleCloseLogin} />
        </div>
    );
}

export default function Home() {
    return (
        <AuthProvider>
            <GameProvider>
                <GameContent />
            </GameProvider>
        </AuthProvider>
    );
}
