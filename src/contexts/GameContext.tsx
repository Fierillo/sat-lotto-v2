'use client';

import { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import type { Bet, Champion, SorteoResult } from '../types';

// ─── State Type ───────────────────────────────────────────────────────

export interface GameContextState {
    // Block info
    currentBlock: number;
    targetBlock: number;
    poolBalance: number;

    // User selection
    selectedNumber: number | null;

    // Game data
    bets: Bet[];
    champions: Champion[];
    lastResult: SorteoResult | null;

    // Victory tracking
    lastVictoryBlock: number;

    // Loading state
    isLoading: boolean;
    error: string | null;
}

// ─── Action Types ─────────────────────────────────────────────────────

type GameAction =
    | { type: 'SET_GAME_DATA'; payload: { block: { height: number; target: number; poolBalance: number }; bets: Bet[]; champions: Champion[]; lastResult: SorteoResult | null } }
    | { type: 'SELECT_NUMBER'; payload: number | null }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_VICTORY_BLOCK'; payload: number };

// ─── Initial State ────────────────────────────────────────────────────

const initialState: GameContextState = {
    currentBlock: 0,
    targetBlock: 0,
    poolBalance: 0,
    selectedNumber: null,
    bets: [],
    champions: [],
    lastResult: null,
    lastVictoryBlock: 0,
    isLoading: true,
    error: null,
};

// ─── Reducer ──────────────────────────────────────────────────────────

function gameReducer(state: GameContextState, action: GameAction): GameContextState {
    switch (action.type) {
        case 'SET_GAME_DATA':
            return {
                ...state,
                currentBlock: action.payload.block.height,
                targetBlock: action.payload.block.target,
                poolBalance: action.payload.block.poolBalance,
                bets: action.payload.bets,
                champions: action.payload.champions,
                lastResult: action.payload.lastResult,
                isLoading: false,
            };
        case 'SELECT_NUMBER':
            return { ...state, selectedNumber: action.payload };
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };
        case 'SET_ERROR':
            return { ...state, error: action.payload, isLoading: false };
        case 'SET_VICTORY_BLOCK':
            return { ...state, lastVictoryBlock: action.payload };
        default:
            return state;
    }
}

// ─── Context ──────────────────────────────────────────────────────────

interface GameContextValue {
    state: GameContextState;
    selectNumber: (num: number | null) => void;
    refreshGame: () => Promise<void>;
    setVictoryBlock: (block: number) => void;
    isFrozen: boolean;
    isResolving: boolean;
}

const GameContext = createContext<GameContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────

export function GameProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(gameReducer, initialState);

    const fetchGameState = useCallback(async () => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });
            const response = await fetch('/api/state');
            if (!response.ok) throw new Error('Failed to fetch game state');
            const data = await response.json();

            dispatch({
                type: 'SET_GAME_DATA',
                payload: {
                    block: data.block,
                    bets: data.activeBets || [],
                    champions: data.champions || [],
                    lastResult: data.lastResult,
                },
            });
            dispatch({ type: 'SET_ERROR', payload: null });
        } catch (e: any) {
            console.error('[GameContext] fetchGameState failed:', e);
            dispatch({ type: 'SET_ERROR', payload: e.message });
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, []);

    // Initialize from localStorage on mount
    useEffect(() => {
        const savedBlock = JSON.parse(localStorage.getItem('satlotto_blocks') || '{}');
        const savedBets = JSON.parse(localStorage.getItem('satlotto_last_bets') || '[]');
        const savedResult = JSON.parse(localStorage.getItem('satlotto_last_result') || 'null');
        const savedPool = parseInt(localStorage.getItem('satlotto_pool') || '0');
        const lastVictoryBlock = parseInt(localStorage.getItem('satlotto_last_victory_block') || '0');

        if (savedBlock.height) {
            dispatch({
                type: 'SET_GAME_DATA',
                payload: {
                    block: { height: savedBlock.height, target: savedBlock.target, poolBalance: savedPool },
                    bets: savedBets,
                    champions: [],
                    lastResult: savedResult,
                },
            });
        }

        if (lastVictoryBlock) {
            dispatch({ type: 'SET_VICTORY_BLOCK', payload: lastVictoryBlock });
        }

        // Fetch fresh data
        fetchGameState();
    }, [fetchGameState]);

    // Persist to localStorage
    useEffect(() => {
        localStorage.setItem('satlotto_blocks', JSON.stringify({
            height: state.currentBlock,
            target: state.targetBlock,
        }));
        localStorage.setItem('satlotto_pool', state.poolBalance.toString());
        localStorage.setItem('satlotto_last_bets', JSON.stringify(state.bets));
        if (state.lastResult) {
            localStorage.setItem('satlotto_last_result', JSON.stringify(state.lastResult));
        }
    }, [state.currentBlock, state.targetBlock, state.poolBalance, state.bets, state.lastResult]);

    // Polling interval (21 seconds)
    useEffect(() => {
        const interval = setInterval(fetchGameState, 21000);
        return () => clearInterval(interval);
    }, [fetchGameState]);

    const selectNumber = useCallback((num: number | null) => {
        dispatch({ type: 'SELECT_NUMBER', payload: num });
    }, []);

    const setVictoryBlock = useCallback((block: number) => {
        dispatch({ type: 'SET_VICTORY_BLOCK', payload: block });
        localStorage.setItem('satlotto_last_victory_block', block.toString());
    }, []);

    const isFrozen = state.targetBlock > 0 && state.currentBlock >= state.targetBlock - 2;
    const isResolving = state.currentBlock === state.targetBlock;

    return (
        <GameContext.Provider value={{
            state,
            selectNumber,
            refreshGame: fetchGameState,
            setVictoryBlock,
            isFrozen,
            isResolving,
        }}>
            {children}
        </GameContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useGame() {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
}
