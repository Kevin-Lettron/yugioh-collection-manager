-- Migration: add role column to users for admin panel access control
-- Values: 'user' (default), 'moderator', 'admin'

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

-- Enforce valid values at DB level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('user', 'moderator', 'admin'));
  END IF;
END $$;

-- Index for fast admin-user lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE role != 'user';
