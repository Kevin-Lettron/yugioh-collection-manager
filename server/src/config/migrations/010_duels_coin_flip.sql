-- Migration: pile ou face au demarrage.
--
-- Regle officielle YGO : le gagnant du pile ou face choisit qui commence
-- (P1 ou P2). Jusqu'ici le siege 0 (challenger) commencait toujours, ce qui
-- retirait au jeu son premier arbitrage. On introduit une phase pre-game entre
-- l'acceptation du duel et le lancement effectif du moteur.
--
--  awaiting_flip   les deux joueurs cliquent chacun leur tour, le RNG serveur
--                  designe le gagnant
--  awaiting_choice le gagnant choisit son siege (P1 ou P2)
--  resolved        first_player_id est pose, le moteur peut demarrer
--
-- Fallback : si le gagnant n'a pas choisi au bout de 30 s, on prend 'P1' pour
-- lui, comme sur EDOPro. Sans borne, un joueur peut geler la partie sans
-- meme la commencer.

ALTER TABLE duels ADD COLUMN IF NOT EXISTS coin_flip_winner_id INTEGER
  REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE duels ADD COLUMN IF NOT EXISTS coin_flip_choice VARCHAR(2);

ALTER TABLE duels ADD COLUMN IF NOT EXISTS phase_pre_game VARCHAR(20);

-- On rattache 'pre_game' aux statuts autorises. Sans ca, la contrainte
-- existante refuse la transition.
ALTER TABLE duels DROP CONSTRAINT IF EXISTS duels_status_check;
ALTER TABLE duels ADD CONSTRAINT duels_status_check
  CHECK (status IN ('pending', 'pre_game', 'active', 'finished', 'cancelled'));

ALTER TABLE duels DROP CONSTRAINT IF EXISTS duels_coin_flip_choice_check;
ALTER TABLE duels ADD CONSTRAINT duels_coin_flip_choice_check
  CHECK (coin_flip_choice IS NULL OR coin_flip_choice IN ('P1', 'P2'));

ALTER TABLE duels DROP CONSTRAINT IF EXISTS duels_phase_pre_game_check;
ALTER TABLE duels ADD CONSTRAINT duels_phase_pre_game_check
  CHECK (phase_pre_game IS NULL OR phase_pre_game IN ('awaiting_flip', 'awaiting_choice', 'resolved'));
