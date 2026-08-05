-- Regles de partie choisies par le challenger au moment du defi.
-- 'standard' : banlist TCG + max 3 exemplaires par carte appliques (defaut, comportement historique).
-- 'free' : aucune restriction hors tailles minimum du deck (40+ main, 15- extra).
-- Immuable une fois le duel cree — sinon un joueur pourrait basculer en free
-- apres validation banlist.

ALTER TABLE duels
  ADD COLUMN IF NOT EXISTS rules_mode VARCHAR(16) NOT NULL DEFAULT 'standard';

-- Contrainte sur les valeurs autorisees. On evite un CHECK dur pour rester
-- extensible (ajout d'un mode "tournoi" plus tard sans migration lourde).
-- La validation stricte se fait cote application.
