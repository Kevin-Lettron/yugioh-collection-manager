-- Migration: salle d'attente — flags "pret" pour les deux joueurs.
--
-- Nouveau flow apres acceptation :
--   1. accept → duel devient `active` (comme avant) MAIS les joueurs atterrissent
--      dans /duel/:id/lobby au lieu de /duel/:id
--   2. Chaque joueur peut changer son deck (POST /duels/:id/change-deck) et
--      confirmer (POST /duels/:id/ready)
--   3. Quand les deux joueurs ont cliqué "Prêt" → nav auto vers /duel/:id
--      qui déclenche le pile ou face + le moteur
--
-- Les flags sont réinitialisés implicitement : ils vivent pour la durée du
-- lobby. Une fois `phase_pre_game` posé, ils ne servent plus (on ne peut plus
-- revenir en arrière).

ALTER TABLE duels ADD COLUMN IF NOT EXISTS challenger_ready BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS opponent_ready   BOOLEAN NOT NULL DEFAULT FALSE;
