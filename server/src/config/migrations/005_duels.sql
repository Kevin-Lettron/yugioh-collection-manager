-- Migration: duels — challenge, accept, real-time PvP.
--
-- Un duel referme tout l'etat d'une partie :
--  - lifecycle (status, winner, timestamps)
--  - progression (phase courante, tour, joueur actif)
--  - LP par joueur
--  - etat de plateau serialise en JSONB (main, deck, monstres, magies/pieges, terrain, cimetiere, banni)
--  - log de chat inline
-- Les states sont NULL tant que le duel n'a pas ete accepte (creation depuis un shuffle du deck opponent).

CREATE TABLE IF NOT EXISTS duels (
  id                        SERIAL PRIMARY KEY,
  challenger_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenger_deck_id        INTEGER REFERENCES decks(id) ON DELETE SET NULL,
  opponent_deck_id          INTEGER REFERENCES decks(id) ON DELETE SET NULL,
  status                    VARCHAR(20) NOT NULL DEFAULT 'pending',
  winner_id                 INTEGER REFERENCES users(id) ON DELETE SET NULL,
  first_player_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  current_turn_player_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  current_phase             VARCHAR(20),
  turn_number               INTEGER NOT NULL DEFAULT 1,
  challenger_lp             INTEGER NOT NULL DEFAULT 8000,
  opponent_lp               INTEGER NOT NULL DEFAULT 8000,
  challenger_state          JSONB,
  opponent_state            JSONB,
  chat_log                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at               TIMESTAMPTZ,
  CONSTRAINT duels_status_check CHECK (status IN ('pending', 'active', 'finished', 'cancelled')),
  CONSTRAINT duels_phase_check  CHECK (current_phase IS NULL OR current_phase IN ('draw', 'main1', 'battle', 'main2', 'end')),
  CONSTRAINT duels_diff_players CHECK (challenger_id <> opponent_id)
);

CREATE INDEX IF NOT EXISTS idx_duels_challenger_status ON duels (challenger_id, status);
CREATE INDEX IF NOT EXISTS idx_duels_opponent_status   ON duels (opponent_id, status);
CREATE INDEX IF NOT EXISTS idx_duels_status            ON duels (status);
