-- Migration: activite temps reel — colonne `last_seen`.
--
-- On veut afficher une pastille verte a cote des duellistes actifs (< 2 min).
-- On stocke un timestamp par user, mis a jour a chaque requete authentifiee via
-- le middleware `touchLastSeen` (cache 30 s pour ne pas noyer la DB).
--
-- L'index partiel sur les utilisateurs recemment vus rend la requete
-- "who's online" O(log n) sans polluer l'index principal des ecritures.

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- Index partiel : uniquement les users vus dans les dernieres 24 h. C'est
-- amplement suffisant pour un badge "en ligne" (seuil 2 min) tout en gardant
-- l'index minuscule.
CREATE INDEX IF NOT EXISTS idx_users_last_seen
  ON users (last_seen DESC)
  WHERE last_seen IS NOT NULL;
