'use client';

import { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { NIP07 } from '../lib/nip07';
import { NWC, restoreSigner } from '../lib/nwc';
import { hasStoredNwc, isLocked, createPin as cryptoCreatePin, verifyPin, encryptNwc, decryptNwc, clearNwcStorage, getAttemptsLeft } from '../lib/crypto';
import { resolveAlias } from '../lib/alias-resolver';
import { createBunkerSession, restoreBunkerSession, deserializeSession, NIP46_RELAYS } from '../lib/nip46';
import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';

// ─── State Type ───────────────────────────────────────────────────────

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
    lastCelebratedBlock: number;
    loginMethod: string | null;
    isInitialized: boolean;
    error: string | null;
    pinModal: PinModalState;
}

// ─── Action Types ─────────────────────────────────────────────────────

type AuthAction =
    | { type: 'LOGIN'; payload: Partial<AuthContextState> }
    | { type: 'LOGOUT' }
    | { type: 'SET_SIGNER'; payload: any }
    | { type: 'SET_NWC_URL'; payload: string }
    | { type: 'SET_LOGIN_EVENT'; payload: any }
    | { type: 'SET_CELEBRATED_BLOCK'; payload: number }
    | { type: 'INITIALIZED' }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'OPEN_PIN_MODAL'; payload: { mode: 'create' | 'verify'; nwcUrl?: string } }
    | { type: 'CLOSE_PIN_MODAL' }
    | { type: 'SET_PIN_ERROR'; payload: { error: string | null; attemptsLeft: number } };

// ─── Initial State ────────────────────────────────────────────────────

const initialState: AuthContextState = {
    pubkey: null,
    signer: null,
    nwcUrl: null,
    bunkerTarget: null,
    bunkerSession: null,
    nip05: null,
    loginEvent: null,
    lastCelebratedBlock: 0,
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

// ─── Reducer ──────────────────────────────────────────────────────────

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
        case 'SET_CELEBRATED_BLOCK':
            return { ...state, lastCelebratedBlock: action.payload };
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

// ─── Context ──────────────────────────────────────────────────────────

interface AuthContextValue {
    state: AuthContextState;
    login: (payload: Partial<AuthContextState>) => void;
    logout: () => void;
    setSigner: (signer: any) => void;
    setNwcUrl: (url: string) => void;
    setLoginEvent: (event: any) => void;
    setCelebratedBlock: (block: number) => void;
    setError: (error: string | null) => void;
    loginWithExtension: () => Promise<void>;
    loginWithNwc: (url: string) => Promise<void>;
    loginWithBunker: (url: string, signer?: any) => Promise<void>;
    verifyPinForNwc: (pin: string) => Promise<boolean>;
    createPinForNwc: (pin: string) => Promise<boolean>;
    closePinModal: () => void;
    checkStoredNwcAndPrompt: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(authReducer, initialState);

    // Initialize from localStorage on mount
    useEffect(() => {
        const pubkey = localStorage.getItem('satlotto_pubkey');
        const bunkerTarget = localStorage.getItem('satlotto_bunker');
        const bunkerSession = localStorage.getItem('satlotto_bunker_session');
        const nip05 = localStorage.getItem('satlotto_alias');
        const loginMethod = localStorage.getItem('satlotto_login_method');
        const lastCelebratedBlock = parseInt(localStorage.getItem('satlotto_last_victory_block') || '0');

        if (pubkey) {
            dispatch({
                type: 'LOGIN',
                payload: {
                    pubkey,
                    bunkerTarget,
                    bunkerSession,
                    nip05,
                    loginMethod,
                    lastCelebratedBlock,
                },
            });
        }
        dispatch({ type: 'INITIALIZED' });
    }, []);

    // Persist to localStorage when state changes
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

    const setCelebratedBlock = useCallback((block: number) => {
        dispatch({ type: 'SET_CELEBRATED_BLOCK', payload: block });
        localStorage.setItem('satlotto_last_victory_block', block.toString());
    }, []);

    const setError = useCallback((error: string | null) => {
        dispatch({ type: 'SET_ERROR', payload: error });
    }, []);

    const closePinModal = useCallback(() => {
        dispatch({ type: 'CLOSE_PIN_MODAL' });
    }, []);

    // Check if there's stored NWC and prompt for PIN
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

    // Login with NIP-07 extension (Alby, nos2x)
    const loginWithExtension = useCallback(async (): Promise<void> => {
        dispatch({ type: 'SET_ERROR', payload: null });
        try {
            if (!NIP07.isAvailable()) {
                throw new Error('No se detectó ninguna extensión de Nostr. Instalá Alby o usá una URL de NWC/Bunker para continuar.');
            }
            const pubkey = await NIP07.getPublicKey();
            const nip05 = await resolveAlias(pubkey);
            login({
                pubkey,
                nip05,
                loginMethod: 'extension',
                signer: window.nostr,
            });
        } catch (e: any) {
            dispatch({ type: 'SET_ERROR', payload: e.message });
            throw e;
        }
    }, [login]);

    // Login with NWC URL
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

    // Verify PIN for stored NWC
    const verifyPinForNwc = useCallback(async (pin: string): Promise<boolean> => {
        const result = await verifyPin(pin);

        if (result.locked) {
            clearNwcStorage();
            dispatch({
                type: 'SET_PIN_ERROR',
                payload: { error: 'Demasiados intentos. Clave borrada por seguridad.', attemptsLeft: 0 }
            });
            return false;
        }

        if (!result.success) {
            dispatch({
                type: 'SET_PIN_ERROR',
                payload: {
                    error: `PIN incorrecto. Quedan ${result.attemptsLeft} intentos.`,
                    attemptsLeft: result.attemptsLeft
                }
            });
            return false;
        }

        const nwcUrl = await decryptNwc(pin);
        if (!nwcUrl) {
            dispatch({ type: 'SET_PIN_ERROR', payload: { error: 'Error al desencriptar.', attemptsLeft: result.attemptsLeft } });
            return false;
        }

        try {
            const signer = restoreSigner(nwcUrl);
            if (!signer) {
                dispatch({ type: 'SET_PIN_ERROR', payload: { error: 'No se pudo crear el signer.', attemptsLeft: result.attemptsLeft } });
                return false;
            }
            const user = await signer.user();
            const nip05 = await resolveAlias(user.pubkey);
            login({
                nwcUrl,
                pubkey: user.pubkey,
                nip05,
                signer,
                loginMethod: 'nwc',
            });
            dispatch({ type: 'CLOSE_PIN_MODAL' });
            return true;
        } catch (e: any) {
            dispatch({ type: 'SET_PIN_ERROR', payload: { error: 'Error al conectar: ' + e.message, attemptsLeft: result.attemptsLeft } });
            return false;
        }
    }, [login]);

    // Create PIN for new NWC
    const createPinForNwc = useCallback(async (pin: string): Promise<boolean> => {
        const nwcUrl = state.pinModal.pinModalUrl;
        if (!nwcUrl) {
            dispatch({ type: 'SET_PIN_ERROR', payload: { error: 'URL de wallet no disponible.', attemptsLeft: 3 } });
            return false;
        }

        try {
            await cryptoCreatePin(pin);
            await encryptNwc(nwcUrl, pin);

            const signer = restoreSigner(nwcUrl);
            if (!signer) {
                dispatch({ type: 'SET_PIN_ERROR', payload: { error: 'No se pudo crear el signer.', attemptsLeft: 3 } });
                return false;
            }
            const user = await signer.user();
            const nip05 = await resolveAlias(user.pubkey);
            login({
                nwcUrl,
                pubkey: user.pubkey,
                nip05,
                signer,
                loginMethod: 'nwc',
            });
            dispatch({ type: 'CLOSE_PIN_MODAL' });
            return true;
        } catch (e: any) {
            dispatch({ type: 'SET_PIN_ERROR', payload: { error: 'Error: ' + e.message, attemptsLeft: 3 } });
            return false;
        }
    }, [login, state.pinModal.pinModalUrl]);

    // Login with bunker
    const loginWithBunker = useCallback(async (url: string, existingSigner?: NDKPrivateKeySigner): Promise<void> => {
        dispatch({ type: 'SET_ERROR', payload: null });
        
        if (!url.startsWith('bunker://') && !url.includes('@')) {
            throw new Error('URL de bunker inválida. Debe empezar con bunker:// o ser un handle@domain');
        }
        
        try {
            const { session, signer } = await createBunkerSession(url, existingSigner);
            const user = await signer.user();
            const pubkey = user.pubkey;
            const nip05 = await resolveAlias(pubkey);
            
            login({
                pubkey,
                nip05,
                bunkerTarget: url,
                bunkerSession: JSON.stringify(session),
                signer,
                loginMethod: 'bunker',
            });
        } catch (e: any) {
            dispatch({ type: 'SET_ERROR', payload: e.message || 'Error al conectar con bunker' });
            throw e;
        }
    }, [login]);

    return (
        <AuthContext.Provider
            value={{
                state,
                login,
                logout,
                setSigner,
                setNwcUrl,
                setLoginEvent,
                setCelebratedBlock,
                setError,
                loginWithExtension,
                loginWithNwc,
                loginWithBunker,
                verifyPinForNwc,
                createPinForNwc,
                closePinModal,
                checkStoredNwcAndPrompt,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
