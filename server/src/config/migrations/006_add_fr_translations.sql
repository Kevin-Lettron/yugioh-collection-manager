-- Ajoute les traductions officielles francaises Konami pour chaque carte.
-- L'API YGOProDeck expose ?language=fr qui renvoie le nom + description
-- traduits par Konami TCG France (source officielle, pas de trad maison).
--
-- On garde name/description en EN comme colonnes canoniques (fallback) et
-- on stocke name_fr/description_fr a cote. Les clients affichent FR par
-- defaut avec fallback EN si la carte n'a pas encore ete backfillee.

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS name_fr TEXT,
  ADD COLUMN IF NOT EXISTS description_fr TEXT;

-- Index sur name_fr pour permettre la recherche FR sans full scan.
CREATE INDEX IF NOT EXISTS idx_cards_name_fr ON cards (LOWER(name_fr));
