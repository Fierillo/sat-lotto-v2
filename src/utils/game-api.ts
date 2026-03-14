/**
 * Game API — Llamadas al backend de SatLotto.
 * 
 * submitBet() → DEPRECATED, usar createBetSigned o createBetUnsigned
 * confirmBet() → confirmar pago
 * fetchGameState() → estado del juego
 * fetchIdentity() → perfil Nostr
 */

import { apiClient } from './api-client';
import { Bet, SorteoResult } from '../types';

// ─── Types ───────────────────────────────────────────────────────────

export interface BetResult {
    paymentRequest: string;
    paymentHash: string;
}

export interface GameStateResponse {
    block: { height: number; target: number; poolBalance: number };
    activeBets: Bet[];
    champions: any[];
    lastResult: SorteoResult | null;
}

// ─── Bets ────────────────────────────────────────────────────────────

/**
 * Crear apuesta SIN firma (Amber / NWC).
 * El server genera la invoice directamente — no necesita evento firmado.
 */
export async function createBetUnsigned(
    targetBlock: number, 
    selectedNumber: number, 
    pubkey: string
): Promise<BetResult> {
    const url = `/api/bet?block=${targetBlock}&number=${selectedNumber}&pubkey=${pubkey}`;
    return apiClient.get<BetResult>(url);
}

/**
 * Crear apuesta CON firma (Extensión / Bunker).
 * Envía un evento kind:1 firmado al backend.
 */
export async function createBetSigned(signedEvent: any): Promise<BetResult> {
    return apiClient.post<BetResult>('/api/bet', { signedEvent });
}

/**
 * Confirmar que una invoice fue pagada.
 * Devuelve true si fue pagada, false si todavía no.
 */
export const confirmBet = (paymentHash: string) =>
    apiClient.post<{ confirmed: boolean }>('/api/bet', { paymentHash, action: 'confirm' })
        .then(r => r.confirmed)
        .catch(() => false);

// ─── Game State ──────────────────────────────────────────────────────

export const fetchGameState = () =>
    apiClient.get<GameStateResponse>('/api/state');

// ─── Identity ────────────────────────────────────────────────────────

export const fetchIdentity = (pubkey: string) =>
    apiClient.get<{ alias: string | null; sats_earned: number }>(`/api/identity/${pubkey}`)
        .catch(() => null);

export const verifyIdentity = (pubkey: string, event: any, blockHeight?: number, lud16?: string) =>
    apiClient.post<{ ok: boolean; alias: string }>(`/api/identity/${pubkey}`, { event, blockHeight, lud16 });
