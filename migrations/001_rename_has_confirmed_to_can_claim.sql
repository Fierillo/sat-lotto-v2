-- Migration: Rename has_confirmed to can_claim + add sats_pending
-- Date: 2025-04-01
-- 
-- IMPORTANT: Execute this AFTER deploying the code changes
-- 
-- Steps:
-- 1. Backup the database before running this migration
--    neon ctrl branch create your-project/migration-backup
-- 2. Run this migration
-- 3. Verify the changes with the SELECT statement at the end

-- Step 1: Rename column (inverts logic: old has_confirmed = TRUE means they HAD confirmed, 
--          new can_claim = TRUE means they CAN claim NOW)
--          Since the old logic was inverted, we need to flip the values
ALTER TABLE lotto_identities RENAME COLUMN has_confirmed TO can_claim;

-- Step 2: Invert the boolean values (old: true = confirmed already; new: true = can claim now)
--          Winners who had confirmed (old=true) now can't claim (new=false)
--          Winners who hadn't confirmed (old=false) now can claim (new=true)
UPDATE lotto_identities SET can_claim = NOT can_claim WHERE winner_block > 0;

-- Step 3: Add sats_pending column
ALTER TABLE lotto_identities ADD COLUMN IF NOT EXISTS sats_pending INTEGER DEFAULT 0;

-- Step 4: Populate sats_pending from failed payouts
UPDATE lotto_identities i SET sats_pending = COALESCE((
    SELECT SUM(amount) FROM lotto_payouts p 
    WHERE p.pubkey = i.pubkey AND p.status = 'failed' AND p.type = 'winner'
), 0) WHERE winner_block > 0;

-- Verification: Check the results
SELECT 
    pubkey, 
    winner_block, 
    can_claim, 
    sats_earned, 
    sats_pending,
    sats_earned + sats_pending as total_sats
FROM lotto_identities 
WHERE winner_block > 0 OR sats_pending > 0
ORDER BY winner_block DESC
LIMIT 20;

-- Rollback script (if needed):
-- ALTER TABLE lotto_identities RENAME COLUMN can_claim TO has_confirmed;
-- ALTER TABLE lotto_identities DROP COLUMN sats_pending;
-- UPDATE lotto_identities SET has_confirmed = NOT has_confirmed WHERE winner_block > 0;