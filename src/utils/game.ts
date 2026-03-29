import { apiClient } from './api-client';
import type { Bet, Champion, SorteoResult, GameStateResponse } from '../types';
import type { UnsignedEvent } from '../types';

export type { GameStateResponse };

export const fetchGameState = () => apiClient.get<GameStateResponse>('/api/state');

export const fetchIdentity = (pubkey: string) => apiClient.get<{ nip05: string | null; sats_earned: number }>(`/api/identity/${pubkey}`).catch(() => null);

export const verifyIdentity = (pubkey: string, event: UnsignedEvent, blockHeight?: number, lud16?: string) =>
    apiClient.post<{ ok: boolean }>(`/api/identity/${pubkey}`, { event, blockHeight, lud16 });
