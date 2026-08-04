-- Migration: mode moteur des duels — journal rejouable et graine.
--
-- Un duel joue par ygopro-core vit dans le tas WebAssembly du worker, et ce
-- moteur n'expose aucune serialisation d'une partie en cours. On ne peut donc
-- pas sauvegarder l'etat. Ce qu'on peut sauvegarder, c'est de quoi le
-- **reconstruire** : la graine du melange et la suite exacte des decisions.
--
-- Meme graine + memes decisions dans le meme ordre = meme partie, le moteur
-- etant deterministe. C'est ce qui rendra un jour possible la reprise apres un
-- redemarrage ; en attendant, cela sert deja au journal et a l'analyse d'une
-- partie terminee.

ALTER TABLE duels ADD COLUMN IF NOT EXISTS engine_mode BOOLEAN NOT NULL DEFAULT FALSE;

-- Les quatre entiers 64 bits de la graine, en texte : PostgreSQL n'a pas
-- d'entier non signe sur 64 bits, et on ne veut surtout pas d'arrondi ici.
ALTER TABLE duels ADD COLUMN IF NOT EXISTS engine_seed TEXT;

CREATE TABLE IF NOT EXISTS duel_engine_actions (
  id          SERIAL PRIMARY KEY,
  duel_id     INTEGER NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
  -- Ordre strict : c'est la cle du rejeu. Une decision hors sequence rendrait
  -- le journal inexploitable.
  seq         INTEGER NOT NULL,
  seat        SMALLINT NOT NULL CHECK (seat IN (0, 1)),
  -- Les identifiants d'options tels que le joueur les a renvoyes. On ne stocke
  -- pas la reponse traduite pour le moteur : elle depend de la demande en
  -- cours, que le rejeu regenerera de toute facon.
  option_ids  TEXT[] NOT NULL DEFAULT '{}',
  cancel      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT duel_engine_actions_seq_unique UNIQUE (duel_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_duel_engine_actions_duel
  ON duel_engine_actions (duel_id, seq);
