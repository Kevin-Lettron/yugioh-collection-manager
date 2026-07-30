-- Migration: add is_active column for soft-disable of accounts
-- Disabled users cannot log in and their existing tokens are rejected,
-- but their data (decks, cards, comments) is preserved. Reversible.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

-- Partial index for fast "list disabled users" queries (small subset expected)
CREATE INDEX IF NOT EXISTS idx_users_disabled
  ON users(is_active)
  WHERE is_active = false;
