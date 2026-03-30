-- SatLotto V2 - Database Schema
-- This schema reflects the actual Neon development database

-- 1. Identidades de Usuario
CREATE TABLE IF NOT EXISTS lotto_identities (
    id SERIAL PRIMARY KEY,
    pubkey TEXT NOT NULL UNIQUE,
    nip05 TEXT,
    lud16 TEXT,
    last_updated TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sats_earned INTEGER DEFAULT 0,
    winner_block INTEGER DEFAULT 0,
    has_confirmed BOOLEAN DEFAULT FALSE
);

-- 2. Apuestas
CREATE TABLE IF NOT EXISTS lotto_bets (
    id SERIAL PRIMARY KEY,
    pubkey TEXT NOT NULL,
    selected_number INTEGER NOT NULL,
    target_block INTEGER NOT NULL,
    betting_block INTEGER NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    nostr_event_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    payment_request TEXT,
    payment_hash TEXT UNIQUE,
    nip05 TEXT
);

-- 3. Historial de Pagos y Control de Ciclos
CREATE TABLE IF NOT EXISTS lotto_payouts (
    id SERIAL PRIMARY KEY,
    pubkey TEXT NOT NULL,
    block_height INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'winner', 'fee', 'cycle_resolved', 'bet'
    status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'failed'
    tx_hash TEXT,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fee INTEGER,
    bet_id INTEGER REFERENCES lotto_bets(id),
    UNIQUE(pubkey, block_height, type)
);

-- 4. Rate Limiting
CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_bets_target ON lotto_bets(target_block);
CREATE INDEX IF NOT EXISTS idx_bets_pubkey ON lotto_bets(pubkey);
CREATE INDEX IF NOT EXISTS idx_bets_event ON lotto_bets(nostr_event_id);
CREATE INDEX IF NOT EXISTS idx_payouts_pubkey ON lotto_payouts(pubkey);
CREATE INDEX IF NOT EXISTS idx_payouts_block_type ON lotto_payouts(block_height, type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);