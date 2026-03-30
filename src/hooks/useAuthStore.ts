'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Signer } from '../types/signer';
import { restoreBunkerSession, deserializeSession } from '@/src/lib/nip46';

interface AuthState {
    pubkey: string | null;
    nip05: string | null;
    loginMethod: string | null;
    nwcUrl: string | null;
    bunkerTarget: string | null;
    bunkerSession: string | null;
    isInitialized: boolean;
}

interface AuthStore extends AuthState {
    signer: Signer;
    setAuth: (payload: Partial<AuthState & { signer?: Signer }>) => void;
    clearAuth: () => void;
}

const STORAGE_KEYS = {
    pubkey: 'satlotto_pubkey',
    nip05: 'satlotto_alias',
    loginMethod: 'satlotto_login_method',
    nwcUrl: 'satlotto_nwc',
    bunkerTarget: 'satlotto_bunker',
    bunkerSession: 'satlotto_bunker_session',
} as const;

export function useAuthStore(): AuthStore {
    const [state, setState] = useState<AuthState>({
        pubkey: null,
        nip05: null,
        loginMethod: null,
        nwcUrl: null,
        bunkerTarget: null,
        bunkerSession: null,
        isInitialized: false,
    });
    const [signer, setSigner] = useState<Signer>(null);

    useEffect(() => {
        const stored: Partial<AuthState> = {
            pubkey: localStorage.getItem(STORAGE_KEYS.pubkey),
            nip05: localStorage.getItem(STORAGE_KEYS.nip05),
            loginMethod: localStorage.getItem(STORAGE_KEYS.loginMethod),
            nwcUrl: localStorage.getItem(STORAGE_KEYS.nwcUrl),
            bunkerTarget: localStorage.getItem(STORAGE_KEYS.bunkerTarget),
            bunkerSession: localStorage.getItem(STORAGE_KEYS.bunkerSession),
        };
        setState(prev => ({ ...prev, ...stored, isInitialized: true }));

        if (stored.loginMethod === 'extension' && typeof window !== 'undefined' && window.nostr) {
            setSigner(window.nostr as unknown as import('../types/signer').NIP07Signer);
        } else if (stored.loginMethod === 'bunker' && stored.bunkerSession) {
            try {
                const session = deserializeSession(stored.bunkerSession);
                const bunkerSigner = restoreBunkerSession(session);
                setSigner(bunkerSigner);
            } catch (e) {
                console.error('[AuthStore] Failed to restore bunker session:', e);
            }
        }
    }, []);

    useEffect(() => {
        if (!state.isInitialized) return;

        if (state.pubkey) {
            localStorage.setItem(STORAGE_KEYS.pubkey, state.pubkey);
        } else {
            localStorage.removeItem(STORAGE_KEYS.pubkey);
        }

        if (state.nip05) {
            localStorage.setItem(STORAGE_KEYS.nip05, state.nip05);
        }

        if (state.loginMethod) {
            localStorage.setItem(STORAGE_KEYS.loginMethod, state.loginMethod);
        }

        if (state.nwcUrl) {
            localStorage.setItem(STORAGE_KEYS.nwcUrl, state.nwcUrl);
        } else {
            localStorage.removeItem(STORAGE_KEYS.nwcUrl);
        }

        if (state.bunkerTarget) {
            localStorage.setItem(STORAGE_KEYS.bunkerTarget, state.bunkerTarget);
        } else {
            localStorage.removeItem(STORAGE_KEYS.bunkerTarget);
        }

        if (state.bunkerSession) {
            localStorage.setItem(STORAGE_KEYS.bunkerSession, state.bunkerSession);
        } else {
            localStorage.removeItem(STORAGE_KEYS.bunkerSession);
        }
    }, [state]);

    const setAuth = useCallback((payload: Partial<AuthState & { signer?: any }>) => {
        setState(prev => ({ ...prev, ...payload }));
        if (payload.signer !== undefined) {
            setSigner(payload.signer);
        }
    }, []);

    const clearAuth = useCallback(() => {
        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
        setState(prev => ({
            pubkey: null,
            nip05: null,
            loginMethod: null,
            nwcUrl: null,
            bunkerTarget: null,
            bunkerSession: null,
            isInitialized: prev.isInitialized,
        }));
        setSigner(null);
    }, []);

    return { ...state, signer, setAuth, clearAuth };
}
