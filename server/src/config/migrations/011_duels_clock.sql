-- Migration: chronometre par joueur (chess-clock).
--
-- Sans chrono, un joueur peut bloquer indefiniment (jusqu'au TTL de 30 min
-- decide dans worker.ts). On donne a chacun un budget total de 25 minutes qui
-- decompte SEULEMENT quand c'est son tour ou qu'il doit repondre a un prompt.
--
-- La verite est cote serveur : `clock_started_at` est le timestamp de derniere
-- reprise, `clock_running_for` le user_id dont le chrono tourne. A chaque coup
-- accepte on solde le temps ecoule dans `p1/p2_clock_ms` et on redemarre pour
-- l'autre siege. Cote front, un setInterval fait tourner la seconde a l'ecran
-- mais la valeur du snapshot toutes les 3 s reste la reference.

ALTER TABLE duels ADD COLUMN IF NOT EXISTS p1_clock_ms INTEGER NOT NULL DEFAULT 1500000;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS p2_clock_ms INTEGER NOT NULL DEFAULT 1500000;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS clock_started_at TIMESTAMPTZ;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS clock_running_for INTEGER
  REFERENCES users(id) ON DELETE SET NULL;
