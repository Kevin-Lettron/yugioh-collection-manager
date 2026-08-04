-- Migration: match en 3 manches (best-of-3) + Side Deck (F4 du plan PLAN-DUEL-AMELIORATIONS).
--
-- Le format de compétition YGO n'est pas « un duel = une partie » : c'est un
-- **match** de 2 ou 3 manches (Bo3). Entre chaque manche, chaque joueur peut
-- échanger jusqu'à 15 cartes entre son Main Deck et son Side Deck — c'est le
-- pilier du méta compétitif. Aujourd'hui la table `duels` ne modélise qu'une
-- manche unique ; on ajoute une couche parente `duel_matches` qui regroupe
-- 1 à 3 duels et suit le score.
--
-- On ne casse rien : un duel « libre » sans match_id continue de fonctionner.

CREATE TABLE IF NOT EXISTS duel_matches (
  id                SERIAL PRIMARY KEY,
  challenger_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Best-of : 2 (première victoire à 2 gagne, max 3 manches) ou 3 (idem, plafonné).
  -- On garde le nom "best_of" mais l'usage est "nombre max de manches" :
  -- Bo3 = jusqu'à 3 manches, gagne à 2. Bo1 = une seule manche, mode « rapide ».
  best_of           INTEGER NOT NULL DEFAULT 3
                    CONSTRAINT duel_matches_best_of_check CHECK (best_of IN (1, 2, 3)),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CONSTRAINT duel_matches_status_check
                      CHECK (status IN ('pending', 'active', 'sideboard', 'finished', 'cancelled')),
  challenger_wins   INTEGER NOT NULL DEFAULT 0,
  opponent_wins     INTEGER NOT NULL DEFAULT 0,
  winner_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at       TIMESTAMPTZ,
  CONSTRAINT duel_matches_diff_players CHECK (challenger_id <> opponent_id)
);

CREATE INDEX IF NOT EXISTS idx_duel_matches_challenger_status
  ON duel_matches (challenger_id, status);
CREATE INDEX IF NOT EXISTS idx_duel_matches_opponent_status
  ON duel_matches (opponent_id, status);

-- Rattache chaque duel à son match parent + son numéro de manche.
-- match_id NULL = duel libre (l'ancien comportement).
ALTER TABLE duels ADD COLUMN IF NOT EXISTS match_id INTEGER
  REFERENCES duel_matches(id) ON DELETE CASCADE;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS game_number INTEGER NOT NULL DEFAULT 1
  CONSTRAINT duels_game_number_check CHECK (game_number BETWEEN 1 AND 3);

CREATE INDEX IF NOT EXISTS idx_duels_match ON duels (match_id, game_number);

-- Side Deck soumis pour la prochaine manche.
--
-- Stocké en JSONB : `{ main: [card_id,...], extra: [card_id,...], side: [card_id,...] }`.
-- Les tableaux portent les `cards.id` (clé interne), pas les passcodes Konami —
-- c'est cohérent avec `deck_cards.card_id`. Le passage aux passcodes se fait
-- au moment de l'engine (deckLoader.ts) via la jointure existante.
CREATE TABLE IF NOT EXISTS duel_side_decks (
  id                SERIAL PRIMARY KEY,
  duel_match_id     INTEGER NOT NULL REFERENCES duel_matches(id) ON DELETE CASCADE,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Numéro de la manche à laquelle cette soumission s'applique (2 ou 3 pour un
  -- match, jamais 1 : la première manche joue le deck de base sans sideboard).
  game_number       INTEGER NOT NULL CHECK (game_number BETWEEN 2 AND 3),
  main_cards        JSONB NOT NULL DEFAULT '[]'::jsonb,
  extra_cards       JSONB NOT NULL DEFAULT '[]'::jsonb,
  side_cards        JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT duel_side_decks_unique UNIQUE (duel_match_id, user_id, game_number)
);

CREATE INDEX IF NOT EXISTS idx_duel_side_decks_match
  ON duel_side_decks (duel_match_id, game_number);

-- Support du Side Deck dans la table des decks.
--
-- Jusqu'ici, `deck_cards.is_extra_deck` distinguait Main / Extra. Le Side Deck
-- réutilise la même table avec un troisième drapeau : on évite une table
-- parallèle qui devrait tout dupliquer. Compat totale : sans is_side_deck posé,
-- les colonnes existantes conservent leur sens et aucun deck n'a de side deck.
ALTER TABLE deck_cards ADD COLUMN IF NOT EXISTS is_side_deck BOOLEAN NOT NULL DEFAULT FALSE;

-- Un enregistrement ne peut pas être à la fois Extra ET Side — c'est nul-sens
-- (une carte Extra ne peut pas sideboarder dans le Main, ni l'inverse).
ALTER TABLE deck_cards DROP CONSTRAINT IF EXISTS deck_cards_deck_side_exclusive;
ALTER TABLE deck_cards ADD CONSTRAINT deck_cards_deck_side_exclusive
  CHECK (NOT (is_extra_deck AND is_side_deck));

CREATE INDEX IF NOT EXISTS idx_deck_cards_side
  ON deck_cards (deck_id, is_side_deck);

