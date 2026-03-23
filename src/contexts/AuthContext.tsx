'use client';

import { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { NIP07 } from '../lib/nip07';
import { NWC, restoreSigner } from '../lib/nwc';
import { hasStoredNwc, isLocked, createPin as cryptoCreatePin, verifyPin, encryptNwc, decryptNwc, clearNwcStorage, getAttemptsLeft } from '../lib/crypto';
import ndk from '../lib/ndk';
import { createBunkerSession, restoreBunkerSession, NIP46_RELAYS } from '../lib/nip46';
import { NDKPrivateKeySigner, NDKNip46Signer } from '@nostr-dev-kit/ndk';

interface PinModalState {
    showPinModal: boolean;
    pinModalMode: 'create' | 'verify';
    pinModalUrl: string | null;
    pinError: string | null;
    pinAttemptsLeft: number;
}

interface AuthContextState {
    pubkey: string | null;
    signer: any | null;
    nwcUrl: string | null;
    bunkerTarget: string | null;
    bunkerSession: string | null;
    nip05: string | null;
    loginEvent: any | null;
    loginMethod: string | null;
    isInitialized: boolean;
    error: string | null;
    pinModal: PinModalState;
}

interface VictoryStatus {
    winner_block: number;
    has_confirmed: boolean;
}

type AuthAction =
    | { type: 'LOGIN'; payload: Partial<AuthContextState> }
    | { type: 'LOGOUT' }
    | { type: 'SET_SIGNER'; payload: any }
    | { type: 'SET_NWC_URL'; payload: string }
    | { type: 'SET_LOGIN_EVENT'; payload: any }
    | { type: 'INITIALIZED' }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'OPEN_PIN_MODAL'; payload: { mode: 'create' | 'verify'; nwcUrl?: string } }
    | { type: 'CLOSE_PIN_MODAL' }
    | { type: 'SET_PIN_ERROR'; payload: { error: string | null; attemptsLeft: number } };

const initialState: AuthContextState = {
    pubkey: null,
    signer: null,
    nwcUrl: null,
    bunkerTarget: null,
    bunkerSession: null,
    nip05: null,
    loginEvent: null,
    loginMethod: null,
    isInitialized: false,
    error: null,
    pinModal: {
        showPinModal: false,
        pinModalMode: 'verify',
        pinModalUrl: null,
        pinError: null,
        pinAttemptsLeft: 3,
    },
};

function authReducer(state: AuthContextState, action: AuthAction): AuthContextState {
    switch (action.type) {
        case 'LOGIN':
            return { ...state, ...action.payload };
        case 'LOGOUT':
            return { ...initialState, isInitialized: true };
        case 'SET_SIGNER':
            return { ...state, signer: action.payload };
        case 'SET_NWC_URL':
            return { ...state, nwcUrl: action.payload };
        case 'SET_LOGIN_EVENT':
            return { ...state, loginEvent: action.payload };
        case 'INITIALIZED':
            return { ...state, isInitialized: true };
        case 'SET_ERROR':
            return { ...state, error: action.payload };
        case 'OPEN_PIN_MODAL':
            return {
                ...state,
                pinModal: {
                    showPinModal: true,
                    pinModalMode: action.payload.mode,
                    pinModalUrl: action.payload.nwcUrl ?? null,
                    pinError: null,
                    pinAttemptsLeft: getAttemptsLeft(),
                },
            };
        case 'CLOSE_PIN_MODAL':
            return {
                ...state,
                pinModal: { ...state.pinModal, showPinModal: false },
            };
        case 'SET_PIN_ERROR':
            return {
                ...state,
                pinModal: {
                    ...state.pinModal,
                    pinError: action.payload.error,
                    pinAttemptsLeft: action.payload.attemptsLeft,
                },
            };
        default:
            return state;
    }
}

interface AuthContextValue {
    state: AuthContextState;
    login: (payload: Partial<AuthContextState>) => void;
    logout: () => void;
    setSigner: (signer: any) => void;
    setNwcUrl: (url: string) => void;
    setLoginEvent: (event: any) => void;
    setError: (error: string | null) => void;
    loginWithExtension: () => Promise<VictoryStatus | null>;
    loginWithNwc: (url: string) => Promise<void>;
    loginWithBunker: (url: string, signer: any, secret: string, relays?: string[], skipHandshake?: boolean) => Promise<VictoryStatus | null>;
    verifyPinForNwc: (pin: string) => Promise<VictoryStatus | null>;
    createPinForNwc: (pin: string) => Promise<VictoryStatus | null>;
    closePinModal: () => void;
    checkStoredNwcAndPrompt: () => Promise<boolean>;
    getVictoryStatus: () => Promise<VictoryStatus>;
    clearVictoryStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(authReducer, initialState);

    useEffect(() => {
        const pubkey = localStorage.getItem('satlotto_pubkey');
        const bunkerTarget = localStorage.getItem('satlotto_bunker');
        const bunkerSession = localStorage.getItem('satlotto_bunker_session');
        const nip05 = localStorage.getItem('satlotto_alias');
        const loginMethod = localStorage.getItem('satlotto_login_method');

        if (pubkey) {
            dispatch({
                type: 'LOGIN',
                payload: {
                    pubkey,
                    bunkerTarget,
                    bunkerSession,
                    nip05,
                    loginMethod,
                },
            });
        }
        dispatch({ type: 'INITIALIZED' });
    }, []);

    useEffect(() => {
        if (!state.isInitialized) return;

        if (state.pubkey) {
            localStorage.setItem('satlotto_pubkey', state.pubkey);
        } else {
            localStorage.removeItem('satlotto_pubkey');
        }

        if (state.bunkerTarget) {
            localStorage.setItem('satlotto_bunker', state.bunkerTarget);
        } else {
            localStorage.removeItem('satlotto_bunker');
        }

        if (state.bunkerSession) {
            localStorage.setItem('satlotto_bunker_session', state.bunkerSession);
        } else {
            localStorage.removeItem('satlotto_bunker_session');
        }

        if (state.nip05) {
            localStorage.setItem('satlotto_alias', state.nip05);
        }

        if (state.loginMethod) {
            localStorage.setItem('satlotto_login_method', state.loginMethod);
        }
    }, [state.pubkey, state.bunkerTarget, state.bunkerSession, state.nip05, state.loginMethod, state.isInitialized]);

    const login = useCallback((payload: Partial<AuthContextState>) => {
        dispatch({ type: 'LOGIN', payload });
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('satlotto_pubkey');
        localStorage.removeItem('satlotto_nwc');
        localStorage.removeItem('satlotto_bunker');
        localStorage.removeItem('satlotto_bunker_session');
        localStorage.removeItem('satlotto_alias');
        localStorage.removeItem('satlotto_login_method');
        dispatch({ type: 'LOGOUT' });
    }, []);

    const setSigner = useCallback((signer: any) => {
        dispatch({ type: 'SET_SIGNER', payload: signer });
    }, []);

    const setNwcUrl = useCallback((url: string) => {
        dispatch({ type: 'SET_NWC_URL', payload: url });
    }, []);

    const setLoginEvent = useCallback((event: any) => {
        dispatch({ type: 'SET_LOGIN_EVENT', payload: event });
    }, []);

    const setError = useCallback((error: string | null) => {
        dispatch({ type: 'SET_ERROR', payload: error });
    }, []);

    const closePinModal = useCallback(() => {
        dispatch({ type: 'CLOSE_PIN_MODAL' });
    }, []);

    const getVictoryStatus = useCallback(async (): Promise<VictoryStatus> => {
        if (!state.pubkey) {
            return { winner_block: 0, has_confirmed: false };
        }
        try {
            const res = await fetch(`/api/identity/${state.pubkey}`);
            const data = await res.json();
            return {
                winner_block: data.winner_block || 0,
                has_confirmed: data.has_confirmed || false,
            };
        } catch {
            return { winner_block: 0, has_confirmed: false };
        }
    }, [state.pubkey]);

    const clearVictoryStatus = useCallback(async () => {
        if (!state.pubkey) return;
        try {
            await fetch(`/api/identity/${state.pubkey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ has_confirmed: false })
            });
        } catch (e) {
            console.error('[clearVictoryStatus] Error:', e);
        }
    }, [state.pubkey]);

    const fetchAndSaveProfile = async (pubkey: string): Promise<string | null> => {
        try {
            const user = ndk.getUser({ pubkey });
            const profile = await user.fetchProfile();

            const alias = profile?.nip05 || profile?.name || profile?.displayName || null;
            const lud16 = profile?.lud16 || profile?.lud06 || null;

            if (alias) localStorage.setItem('satlotto_alias', alias);
            if (lud16) localStorage.setItem('satlotto_lud16', lud16);

            const finalLud16 = lud16 || alias;
            if (finalLud16) {
                await fetch(`/api/identity/${pubkey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lud16: finalLud16 })
                });
            }

            return alias;
        } catch (e) {
            console.error('[fetchAndSaveProfile] Error:', e);
            return localStorage.getItem('satlotto_alias');
        }
    };

    const checkStoredNwcAndPrompt = useCallback(async (): Promise<boolean> => {
        const hasStored = await hasStoredNwc();
        if (hasStored && !isLocked()) {
            dispatch({ type: 'OPEN_PIN_MODAL', payload: { mode: 'verify' } });
            return true;
        }
        if (hasStored && isLocked()) {
            clearNwcStorage();
        }
        return false;
    }, []);

    const loginWithExtension = useCallback(async (): Promise<VictoryStatus | null> => {
        dispatch({ type: 'SET_ERROR', payload: null });
        try {
            if (!NIP07.isAvailable()) {
                throw new Error('No se detectó ninguna extensión de Nostr. Instalá Alby o usá una URL de NWC/Bunker para continuar.');
            }
            const pubkey = await NIP07.getPublicKey();
            const nip05 = await fetchAndSaveProfile(pubkey);
            login({
                pubkey,
                nip05,
                loginMethod: 'extension',
                signer: window.nostr,
            });
            return await getVictoryStatus();
        } catch (e: any) {
            dispatch({ type: 'SET_ERROR', payload: e.message });
            throw e;
        }
    }, [login, getVictoryStatus]);

    const loginWithNwc = useCallback(async (url: string): Promise<void> => {
        dispatch({ type: 'SET_ERROR', payload: null });
        
        if (!url.startsWith('nostr+walletconnect://')) {
            throw new Error('URL inválida. Debe empezar con nostr+walletconnect://');
        }

        try {
            const secret = new URL(url.replace('nostr+walletconnect:', 'http:')).searchParams.get('secret');
            if (!secret) {
                throw new Error('La URL no contiene la clave secreta (secret)');
            }
        } catch (e: any) {
            throw new Error('URL inválida: ' + e.message);
        }

        const hasStored = await hasStoredNwc();
        const locked = isLocked();

        if (hasStored && locked) {
            clearNwcStorage();
            dispatch({ type: 'SET_ERROR', payload: 'Tu NWC fue borrado por seguridad. Conectá uno nuevo.' });
            dispatch({ type: 'OPEN_PIN_MODAL', payload: { mode: 'create', nwcUrl: url } });
            return;
        }

        if (hasStored && !locked) {
            dispatch({ type: 'OPEN_PIN_MODAL', payload: { mode: 'verify', nwcUrl: url } });
        } else {
            dispatch({ type: 'OPEN_PIN_MODAL', payload: { mode: 'create', nwcUrl: url } });
        }
    }, []);

    const verifyPinForNwc = useCallback(async (pin: string): Promise<VictoryStatus | null> => {
        const result = await verifyPin(pin);

        if (result.locked) {
            clearNwcStorage();
            dispatch({
                type: 'SET_PIN_ERROR',
                payload: { error: 'Demasiados intentos. Clave borrada por seguridad.', attemptsLeft: 0 }
            });
            return null;
        }

        if (!result.success) {
            dispatch({
                type: 'SET_PIN_ERROR',
                payload: {
                    error: `PIN incorrecto. Quedan ${result.attemptsLeft} intentos.`,
                    attemptsLeft: result.attemptsLeft
                }
            });
            return null;
        }

        const nwcUrl = await decryptNwc(pin);
        if (!nwcUrl) {
            dispatch({ type: 'SET_PIN_ERROR', payload: { error: 'Error al desencriptar.', attemptsLeft: result.attemptsLeft } });
            return null;
        }

        try {
            const signer = restoreSigner(nwcUrl);
            if (!signer) {
                dispatch({ type: 'SET_PIN_ERROR', payload: { error: 'No se pudo crear el signer.', attemptsLeft: result.attemptsLeft } });
                return null;
            }
            const user = await signer.user();
            const nip05 = await fetchAndSaveProfile(user.pubkey);
            login({
                nwcUrl,
                pubkey: user.pubkey,
                nip05,
                signer,
                loginMethod: 'nwc',
            });
            dispatch({ type: 'CLOSE_PIN_MODAL' });
            return await getVictoryStatus();
        } catch (e: any) {
            dispatch({ type: 'SET_PIN_ERROR', payload: { error: 'Error al conectar: ' + e.message, attemptsLeft: result.attemptsLeft } });
            return null;
        }
    }, [login, getVictoryStatus]);

    const createPinForNwc = useCallback(async (pin: string): Promise<VictoryStatus | null> => {
        const nwcUrl = state.pinModal.pinModalUrl;
        if (!nwcUrl) {
            dispatch({ type: 'SET_PIN_ERROR', payload: { error: 'URL de wallet no disponible.', attemptsLeft: 3 } });
            return null;
        }

        try {
            await cryptoCreatePin(pin);
            await encryptNwc(nwcUrl, pin);

            const signer = restoreSigner(nwcUrl);
            if (!signer) {
                dispatch({ type: 'SET_PIN_ERROR', payload: { error: 'No se pudo crear el signer.', attemptsLeft: 3 } });
                return null;
            }
            const user = await signer.user();
            const nip05 = await fetchAndSaveProfile(user.pubkey);
            login({
                nwcUrl,
                pubkey: user.pubkey,
                nip05,
                signer,
                loginMethod: 'nwc',
            });
            dispatch({ type: 'CLOSE_PIN_MODAL' });
            return await getVictoryStatus();
        } catch (e: any) {
            dispatch({ type: 'SET_PIN_ERROR', payload: { error: 'Error: ' + e.message, attemptsLeft: 3 } });
            return null;
        }
    }, [login, getVictoryStatus, state.pinModal.pinModalUrl]);

    const loginWithBunker = useCallback(async (
        url: string,
        signer: NDKNip46Signer | NDKPrivateKeySigner,
        secret: string,
        relays?: string[],
        skipHandshake?: boolean
    ): Promise<VictoryStatus | null> => {
        dispatch({ type: 'SET_ERROR', payload: null });

        if (!url.startsWith('bunker://') && !url.includes('@')) {
            throw new Error('URL de bunker inválida. Debe empezar con bunker:// o ser un handle@domain');
        }

        try {
            let bunkerSigner: NDKNip46Signer;
            let sessionData: string | null = null;

            if (signer instanceof NDKNip46Signer) {
                bunkerSigner = signer;
                sessionData = state.bunkerSession;
            } else {
                const result = await createBunkerSession(url, signer, secret, relays, skipHandshake);
                bunkerSigner = result.signer;
                sessionData = JSON.stringify(result.session);
            }

            const pubkey = (bunkerSigner as any).remotePubkey;
            const nip05 = await fetchAndSaveProfile(pubkey);

            login({
                pubkey,
                nip05,
                bunkerTarget: url,
                bunkerSession: sessionData,
                signer: bunkerSigner,
                loginMethod: 'bunker',
            });
            return await getVictoryStatus();
        } catch (e: any) {
            dispatch({ type: 'SET_ERROR', payload: e.message || 'Error al conectar con bunker' });
            throw e;
        }
    }, [login, getVictoryStatus, state.bunkerSession]);

    return (
        <AuthContext.Provider
            value={{
                state,
                login,
                logout,
                setSigner,
                setNwcUrl,
                setLoginEvent,
                setError,
                loginWithExtension,
                loginWithNwc,
                loginWithBunker,
                verifyPinForNwc,
                createPinForNwc,
                closePinModal,
                checkStoredNwcAndPrompt,
                getVictoryStatus,
                clearVictoryStatus,
            }}
        >
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