-- Migration: Add share_token column to decks table
-- Date: 2026-01-20
-- Description: Allows deck sharing via unique token for guest access

-- Add share_token column to decks table
ALTER TABLE decks ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) UNIQUE;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_decks_share_token ON decks(share_token);
