'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useAuthStore } from '../hooks/useAuthStore';
import {
    loginWithExtension,
    loginWithNwc,
    loginWithBunker,
    verifyPinForNwc,
    createPinForNwc,
    getVictoryStatus,
    clearVictoryStatus,
    checkStoredNwc,
    VictoryStatus,
} from '../utils/auth-methods';
import { getAttemptsLeft } from '../lib/crypto';
import type { Signer } from '../types/signer';
import { NDKPrivateKeySigner, NDKNip46Signer } from '@nostr-dev-kit/ndk';

interface PinModalState {
    showPinModal: boolean;
    pinModalMode: 'create' | 'verify';
    pinModalUrl: string | null;
    pinError: string | null;
    pinAttemptsLeft: number;
}

interface AuthContextValue {
    state: {
        pubkey: string | null;
        nip05: string | null;
        loginMethod: string | null;
        nwcUrl: string | null;
        bunkerTarget: string | null;
        bunkerSession: string | null;
        signer: Signer;
        isInitialized: boolean;
        error: string | null;
        pinModal: PinModalState;
    };
    login: (payload: Partial<{ signer: Signer } & Record<string, unknown>>) => void;
    logout: () => void;
    setError: (error: string | null) => void;
    loginWithExtension: () => Promise<VictoryStatus | null>;
    loginWithNwc: (url: string) => Promise<void>;
    loginWithBunker: (url: string, signer: NDKPrivateKeySigner | NDKNip46Signer, secret: string, relays?: string[], skipHandshake?: boolean) => Promise<VictoryStatus | null>;
    verifyPinForNwc: (pin: string) => Promise<VictoryStatus | null>;
    createPinForNwc: (pin: string) => Promise<VictoryStatus | null>;
    closePinModal: () => void;
    checkStoredNwcAndPrompt: () => Promise<boolean>;
    getVictoryStatus: () => Promise<VictoryStatus>;
    clearVictoryStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const store = useAuthStore();
    const [error, setError] = useState<string | null>(null);
    const [pinModal, setPinModal] = useState<PinModalState>({
        showPinModal: false,
        pinModalMode: 'verify',
        pinModalUrl: null,
        pinError: null,
        pinAttemptsLeft: 3,
    });

    const login = useCallback((payload: any) => {
        store.setAuth(payload);
    }, [store]);

    const logout = useCallback(() => {
        store.clearAuth();
    }, [store]);

    const openPinModal = useCallback((payload: { mode: 'create' | 'verify'; nwcUrl?: string }) => {
        setPinModal({
            showPinModal: true,
            pinModalMode: payload.mode,
            pinModalUrl: payload.nwcUrl ?? null,
            pinError: null,
            pinAttemptsLeft: getAttemptsLeft(),
        });
    }, []);

    const closePinModal = useCallback(() => {
        setPinModal(prev => ({ ...prev, showPinModal: false }));
    }, []);

    const setPinError = useCallback((payload: { error: string | null; attemptsLeft: number }) => {
        setPinModal(prev => ({ ...prev, pinError: payload.error, pinAttemptsLeft: payload.attemptsLeft }));
    }, []);

    const actions = {
        setAuth: store.setAuth,
        clearAuth: store.clearAuth,
        openPinModal,
        closePinModal,
        setPinError,
        setError,
        pinModalUrl: pinModal.pinModalUrl,
        bunkerSession: store.bunkerSession,
    };

    const handleLoginWithExtension = useCallback(async (): Promise<VictoryStatus | null> => {
        return loginWithExtension(actions);
    }, [actions]);

    const handleLoginWithNwc = useCallback(async (url: string): Promise<void> => {
        return loginWithNwc(url, actions);
    }, [actions]);

    const handleLoginWithBunker = useCallback(async (
        url: string,
        signer: any,
        secret: string,
        relays?: string[],
        skipHandshake?: boolean
    ): Promise<VictoryStatus | null> => {
        return loginWithBunker(url, signer, secret, relays, skipHandshake, actions);
    }, [actions]);

    const handleVerifyPin = useCallback(async (pin: string): Promise<VictoryStatus | null> => {
        return verifyPinForNwc(pin, actions);
    }, [actions]);

    const handleCreatePin = useCallback(async (pin: string): Promise<VictoryStatus | null> => {
        return createPinForNwc(pin, actions);
    }, [actions]);

    const handleCheckStoredNwc = useCallback(async (): Promise<boolean> => {
        const hasStored = await checkStoredNwc();
        if (hasStored) {
            openPinModal({ mode: 'verify' });
        }
        return hasStored;
    }, [openPinModal]);

    const handleGetVictoryStatus = useCallback(async (): Promise<VictoryStatus> => {
        return getVictoryStatus(store.pubkey);
    }, [store.pubkey]);

    const handleClearVictoryStatus = useCallback(async (): Promise<void> => {
        return clearVictoryStatus(store.pubkey);
    }, [store.pubkey]);

    const value: AuthContextValue = {
        state: {
            pubkey: store.pubkey,
            nip05: store.nip05,
            loginMethod: store.loginMethod,
            nwcUrl: store.nwcUrl,
            bunkerTarget: store.bunkerTarget,
            bunkerSession: store.bunkerSession,
            signer: store.signer,
            isInitialized: store.isInitialized,
            error,
            pinModal,
        },
        login,
        logout,
        setError,
        loginWithExtension: handleLoginWithExtension,
        loginWithNwc: handleLoginWithNwc,
        loginWithBunker: handleLoginWithBunker,
        verifyPinForNwc: handleVerifyPin,
        createPinForNwc: handleCreatePin,
        closePinModal,
        checkStoredNwcAndPrompt: handleCheckStoredNwc,
        getVictoryStatus: handleGetVictoryStatus,
        clearVictoryStatus: handleClearVictoryStatus,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
