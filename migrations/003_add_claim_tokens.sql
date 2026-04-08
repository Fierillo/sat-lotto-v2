-- Create table for ephemeral claim tokens
CREATE TABLE IF NOT EXISTS lotto_claim_tokens (
    id SERIAL PRIMARY KEY,
    pubkey TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    used BOOLEAN DEFAULT FALSE
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_lotto_claim_tokens_token ON lotto_claim_tokens(token);
CREATE INDEX IF NOT EXISTS idx_lotto_claim_tokens_pubkey ON lotto_claim_tokens(pubkey);
