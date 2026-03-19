'use client';

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function UserPanel() {
    const { state, logout } = useAuth();
    const [showMenu, setShowMenu] = useState(false);

    if (!state.pubkey) return null;

    const isMobile = typeof window !== 'undefined' && 
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    const username = state.nip05 || 
        `${state.pubkey.slice(0, 8)}...${state.pubkey.slice(-4)}`;
    
    const methodLabels: Record<string, string> = {
        amber: 'movil',
        nwc: 'nwc',
        bunker: 'bunker',
        extension: isMobile ? 'movil+ext' : 'extension'
    };
    
    const methodLabel = methodLabels[state.loginMethod || ''] || state.loginMethod;

    return (
        <div className="user-panel" onClick={() => setShowMenu(!showMenu)}>
            <span className="user-alias">{username}</span>
            <span className="method-badge">{methodLabel}</span>
            <div className={`logout-menu ${showMenu ? 'active' : ''}`}>
                <button onClick={(e) => { e.stopPropagation(); logout(); }}>
                    Cerrar Sesión
                </button>
            </div>
        </div>
    );
}
