-- 1. Create lotto_state table for centralized state management
CREATE TABLE IF NOT EXISTS lotto_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    current_block INTEGER NOT NULL,
    target_block INTEGER NOT NULL,
    pool_balance INTEGER NOT NULL DEFAULT 0,
    last_resolved_block INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- 2. Initialize state if empty
INSERT INTO lotto_state (id, current_block, target_block, pool_balance) 
VALUES (1, 890000, 890021, 0) ON CONFLICT DO NOTHING;

-- 3. Consolidate lotto_identities changes (renaming and adding sats_pending)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lotto_identities' AND column_name='has_confirmed') THEN
        ALTER TABLE lotto_identities RENAME COLUMN has_confirmed TO can_claim;
        UPDATE lotto_identities SET can_claim = NOT can_claim WHERE winner_block > 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lotto_identities' AND column_name='sats_pending') THEN
        ALTER TABLE lotto_identities ADD COLUMN sats_pending INTEGER DEFAULT 0;
        UPDATE lotto_identities i SET sats_pending = COALESCE((
            SELECT SUM(amount) FROM lotto_payouts p 
            WHERE p.pubkey = i.pubkey AND p.status = 'failed' AND p.type = 'winner'
        ), 0) WHERE winner_block > 0;
    END IF;
END $$;
