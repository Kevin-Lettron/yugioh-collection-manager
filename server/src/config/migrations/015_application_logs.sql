-- Migration 015 : logs applicatifs centralisés en base
--
-- Historiquement les erreurs partaient dans /logs/error-YYYY-MM-DD.log (fichier
-- winston). Utile en autopsie sur le serveur, inutile en live depuis le navigateur
-- de l'admin. Cette table absorbe les mêmes évènements pour alimenter la page
-- /admin/logs — un endroit unique où erreurs serveur, erreurs front, warnings et
-- crashs cohabitent, streamés temps réel via socket.io.
--
-- Rétention volontairement courte (7 jours, purgée par le cron quotidien de
-- server/src/index.ts) : la valeur est dans le debug live, pas dans l'archivage
-- long terme — les fichiers winston restent la source de vérité pour l'historique.

CREATE TABLE IF NOT EXISTS application_logs (
  id          BIGSERIAL PRIMARY KEY,
  level       VARCHAR(10)  NOT NULL,   -- 'error' | 'warn' | 'info'
  source      VARCHAR(20)  NOT NULL,   -- 'server' | 'client' | 'crash' | 'http'
  message     TEXT         NOT NULL,
  stack       TEXT,
  url         TEXT,                    -- URL front (client) ou route API (server/http)
  user_id     INT          REFERENCES users(id) ON DELETE SET NULL,
  meta        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Tri chronologique inverse (page = "les derniers d'abord").
CREATE INDEX IF NOT EXISTS idx_application_logs_created
  ON application_logs (created_at DESC);

-- Filtres UI par niveau et source, combinés au tri chronologique inverse.
CREATE INDEX IF NOT EXISTS idx_application_logs_level
  ON application_logs (level, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_application_logs_source
  ON application_logs (source, created_at DESC);
