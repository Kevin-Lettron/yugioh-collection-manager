-- Migration: add expiration to deck share tokens
-- Security hardening: long-lived share tokens = permanent access if leaked.

ALTER TABLE decks
  ADD COLUMN IF NOT EXISTS share_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Backfill existing tokens with a 30-day expiration from now (grace period)
UPDATE decks
   SET share_token_expires_at = NOW() + INTERVAL '30 days'
 WHERE share_token IS NOT NULL
   AND share_token_expires_at IS NULL;

-- Faster lookup + auto-skip expired tokens
CREATE INDEX IF NOT EXISTS idx_decks_share_token_active
  ON decks (share_token)
  WHERE share_token IS NOT NULL;
