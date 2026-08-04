-- Traductions FR des articles agreges. Les flux sont en anglais (aucun flux
-- Yu-Gi-Oh francais fiable n'existe, cf. docs/PLAN-ACTUALITES.md §2) mais
-- l'interface doit rester en francais. On traduit titre + resume via Claude
-- au moment de l'ingest et on cache en DB. Fallback = version EN d'origine.

ALTER TABLE news_items
  ADD COLUMN IF NOT EXISTS title_fr    TEXT,
  ADD COLUMN IF NOT EXISTS summary_fr  TEXT,
  -- Timestamp de la derniere traduction reussie. Sert au backfill pour retrier
  -- ce qui n'a jamais ete traduit + au diagnostic si Claude devient indispo.
  ADD COLUMN IF NOT EXISTS translated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_news_items_translated ON news_items (translated_at)
  WHERE title_fr IS NULL;
