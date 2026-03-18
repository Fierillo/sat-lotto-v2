'use client';

import { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';

// ─── State Type ───────────────────────────────────────────────────────

interface AuthContextState {
    pubkey: string | null;
    signer: any | null;
    nwcUrl: string | null;
    bunkerTarget: string | null;
    localPrivkey: string | null;
    nip05: string | null;
    loginEvent: any | null;
    lastCelebratedBlock: number;
    loginMethod: string | null;
    isInitialized: boolean;
}

// ─── Action Types ─────────────────────────────────────────────────────

type AuthAction =
    | { type: 'LOGIN'; payload: Partial<AuthContextState> }
    | { type: 'LOGOUT' }
    | { type: 'SET_SIGNER'; payload: any }
    | { type: 'SET_NWC_URL'; payload: string }
    | { type: 'SET_LOGIN_EVENT'; payload: any }
    | { type: 'SET_CELEBRATED_BLOCK'; payload: number }
    | { type: 'INITIALIZED' };

// ─── Initial State ────────────────────────────────────────────────────

const initialState: AuthContextState = {
    pubkey: null,
    signer: null,
    nwcUrl: null,
    bunkerTarget: null,
    localPrivkey: null,
    nip05: null,
    loginEvent: null,
    lastCelebratedBlock: 0,
    loginMethod: null,
    isInitialized: false,
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(authReducer, initialState);

    // Initialize from localStorage on mount
    useEffect(() => {
        const pubkey = localStorage.getItem('satlotto_pubkey');
        const bunkerTarget = localStorage.getItem('satlotto_bunker');
        const localPrivkey = localStorage.getItem('satlotto_local_privkey');
        const nip05 = localStorage.getItem('satlotto_alias');
        const loginMethod = localStorage.getItem('satlotto_login_method');
        const lastCelebratedBlock = parseInt(localStorage.getItem('satlotto_last_victory_block') || '0');

        if (pubkey) {
            dispatch({
                type: 'LOGIN',
                payload: {
                    pubkey,
                    bunkerTarget,
                    localPrivkey,
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

        if (state.nwcUrl) {
            localStorage.setItem('satlotto_nwc', state.nwcUrl);
        }

        if (state.bunkerTarget) {
            localStorage.setItem('satlotto_bunker', state.bunkerTarget);
        }

        if (state.localPrivkey) {
            localStorage.setItem('satlotto_local_privkey', state.localPrivkey);
        }

        if (state.nip05) {
            localStorage.setItem('satlotto_alias', state.nip05);
        }

        if (state.loginMethod) {
            localStorage.setItem('satlotto_login_method', state.loginMethod);
        }
    }, [state.pubkey, state.nwcUrl, state.bunkerTarget, state.localPrivkey, state.nip05, state.loginMethod, state.isInitialized]);

    const login = useCallback((payload: Partial<AuthContextState>) => {
        dispatch({ type: 'LOGIN', payload });
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('satlotto_pubkey');
        localStorage.removeItem('satlotto_nwc');
        localStorage.removeItem('satlotto_bunker');
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

    return (
        <AuthContext.Provider value={{ state, login, logout, setSigner, setNwcUrl, setLoginEvent, setCelebratedBlock }}>
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
