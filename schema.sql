-- SatLotto V2 - Database Schema

-- 1. Identidades de Usuario
CREATE TABLE IF NOT EXISTS lotto_identities (
    id SERIAL PRIMARY KEY,
    pubkey TEXT NOT NULL UNIQUE,
    alias TEXT,
    nip05 TEXT,
    lud16 TEXT,
    sats_earned INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE,
    last_celebrated_block INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Apuestas
CREATE TABLE IF NOT EXISTS lotto_bets (
    id SERIAL PRIMARY KEY,
    pubkey TEXT NOT NULL,
    alias TEXT,
    selected_number INTEGER NOT NULL,
    target_block INTEGER NOT NULL,
    betting_block INTEGER NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    payment_request TEXT,
    payment_hash TEXT,
    nostr_event_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pubkey, target_block)
);

-- 3. Historial de Pagos y Control de Ciclos
CREATE TABLE IF NOT EXISTS lotto_payouts (
    id SERIAL PRIMARY KEY,
    pubkey TEXT NOT NULL,
    block_height INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'winner', 'fee', 'cycle_resolved'
    status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'failed'
    tx_hash TEXT,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pubkey, block_height, type)
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_bets_target ON lotto_bets(target_block);
CREATE INDEX IF NOT EXISTS idx_bets_pubkey ON lotto_bets(pubkey);
CREATE INDEX IF NOT EXISTS idx_bets_event ON lotto_bets(nostr_event_id);
CREATE INDEX IF NOT EXISTS idx_payouts_pubkey ON lotto_payouts(pubkey);
CREATE INDEX IF NOT EXISTS idx_payouts_block_type ON lotto_payouts(block_height, type);
