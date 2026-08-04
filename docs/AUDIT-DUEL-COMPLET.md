# Audit exhaustif — moteur duel + règles YGO

> Branche : `dev` · Date : 2026-08-04
> Périmètre : ce qui reste à combler dans l'intégration `ocgcore-wasm` v1
> (livrée Blocs 1 à 5) pour couvrir intégralement le vocabulaire du moteur ET
> les règles YGO officielles.
> Références de code en chemins absolus + numéros de ligne.

---

## 1. Enums moteur `ocgcore-wasm` — couverture réelle

Références lues :
- `c:\laragon\www\New-YugiohCollection\server\node_modules\ocgcore-wasm\dist\index.d.ts`
- `c:\laragon\www\New-YugiohCollection\server\src\services\duelEngine\session.ts`
- `c:\laragon\www\New-YugiohCollection\server\src\services\duelEngine\prompt.ts`
- `c:\laragon\www\New-YugiohCollection\server\src\services\duelEngine\snapshot.ts`

### 1.1 `OcgMessageType` — 91 valeurs déclarées

Colonne "État" : ✅ absorbé (session.ts) ou routé en prompt (prompt.ts). ❌ non
traité. ➖ hors périmètre assumé (cf. `PLAN-DUEL-AMELIORATIONS.md §3.3`).

| Code | Nom | État | Endroit / Justification |
|---:|---|:-:|---|
| 1 | RETRY | ✅ | session.ts:289 — toast rouge filtré au bon siège |
| 2 | HINT | ✅ | session.ts:911 — SELECTMSG/MESSAGE/EVENT/OPSELECTED |
| 3 | WAITING | ✅ | session.ts:866 → combatLog |
| 4 | START | ❌ | Aucun traitement — sans effet visible mais mérite un log de démarrage |
| 5 | WIN | ✅ | session.ts:376 — `winner` + `winReason` |
| 6 | UPDATE_DATA | ➖ | Deprecated dans le .d.ts (`@deprecated`) |
| 7 | UPDATE_CARD | ➖ | Deprecated |
| 8 | REQUEST_DECK | ➖ | Deprecated |
| 10 | SELECT_BATTLECMD | ✅ | prompt.ts:273 (invite) |
| 11 | SELECT_IDLECMD | ✅ | prompt.ts:231 |
| 12 | SELECT_EFFECTYN | ✅ | prompt.ts:433 |
| 13 | SELECT_YESNO | ✅ | prompt.ts:449 |
| 14 | SELECT_OPTION | ✅ | prompt.ts:404 |
| 15 | SELECT_CARD | ✅ | prompt.ts:299 |
| 16 | SELECT_CHAIN | ✅ | prompt.ts:347 |
| 18 | SELECT_PLACE | ✅ | prompt.ts:365 |
| 19 | SELECT_POSITION | ✅ | prompt.ts:391 |
| 20 | SELECT_TRIBUTE | ✅ | prompt.ts:315 |
| 21 | SORT_CHAIN | ✅ | prompt.ts:481 |
| 22 | SELECT_COUNTER | ✅ | prompt.ts:555 |
| 23 | SELECT_SUM | ✅ | prompt.ts:465 |
| 24 | SELECT_DISFIELD | ✅ | prompt.ts:365 (partagé avec SELECT_PLACE) |
| 25 | SORT_CARD | ✅ | prompt.ts:481 |
| 26 | SELECT_UNSELECT_CARD | ✅ | prompt.ts:328 |
| 30 | CONFIRM_DECKTOP | ✅ | session.ts:302 → RevealBatch |
| 31 | CONFIRM_CARDS | ✅ | session.ts:302 |
| 32 | SHUFFLE_DECK | ✅ | session.ts:596 |
| 33 | SHUFFLE_HAND | ✅ | session.ts:568 — étanchéité par `forPlayers` |
| 34 | REFRESH_DECK | ➖ | Deprecated |
| 35 | SWAP_GRAVE_DECK | ❌ | Non absorbé — Necroface, Exchange of the Spirit ; passe silencieusement, l'état reste correct après re-query |
| 36 | SHUFFLE_SET_CARD | ❌ | Non absorbé — Necrovalley shuffling face-down monsters ; l'animation « mélange face verso » manque |
| 37 | REVERSE_DECK | ❌ | Non absorbé — Book of Eclipse, cartes très rares ; état re-query OK |
| 38 | DECK_TOP | ✅ | session.ts:620 (avec fuite passcode filtrée) |
| 39 | SHUFFLE_EXTRA | ✅ | session.ts:607 |
| 40 | NEW_TURN | ✅ | session.ts:332 |
| 41 | NEW_PHASE | ✅ | session.ts:338 |
| 42 | CONFIRM_EXTRATOP | ✅ | session.ts:302 |
| 50 | MOVE | ✅ | session.ts:496 |
| 53 | POS_CHANGE | ✅ | session.ts:521 |
| 54 | SET | ✅ | session.ts:797 — journalisé, animation non détaillée |
| 55 | SWAP | ✅ | session.ts:535 |
| 56 | FIELD_DISABLED | ✅ | session.ts:742 |
| 60 | SUMMONING | ✅ | session.ts:420 |
| 61 | SUMMONED | ✅ | session.ts:470 |
| 62 | SPSUMMONING | ✅ | session.ts:428 (avec variante Fusion/Synchro/Xyz/Link/Ritual/Pendulum) |
| 63 | SPSUMMONED | ✅ | session.ts:480 (no-op volontaire — déjà couvert par SPSUMMONING) |
| 64 | FLIPSUMMONING | ✅ | session.ts:455 |
| 65 | FLIPSUMMONED | ✅ | session.ts:486 |
| 70 | CHAINING | ✅ | session.ts:463 |
| 71 | CHAINED | ✅ | session.ts:699 |
| 72 | CHAIN_SOLVING | ✅ | session.ts:710 |
| 73 | CHAIN_SOLVED | ✅ | session.ts:721 |
| 74 | CHAIN_END | ✅ | session.ts:732 |
| 75 | CHAIN_NEGATED | ✅ | session.ts:848 → combatLog |
| 76 | CHAIN_DISABLED | ✅ | session.ts:857 |
| 80 | CARD_SELECTED | ❌ | Non absorbé — annonce publique qu'une carte a été retenue par un effet (Reasoning, Number Wall…). Impact narratif faible |
| 81 | RANDOM_SELECTED | ❌ | Non absorbé — annonce d'une sélection aléatoire (Card Destruction random target). Impact narratif faible |
| 83 | BECOME_TARGET | ✅ | session.ts:664 |
| 90 | DRAW | ✅ | session.ts:385 (avec filtrage codes propriétaire/adversaire) |
| 91 | DAMAGE | ✅ | session.ts:348 |
| 92 | RECOVER | ✅ | session.ts:355 |
| 93 | EQUIP | ✅ | session.ts:552 |
| 94 | LPUPDATE | ✅ | session.ts:369 |
| 96 | CARD_TARGET | ✅ | session.ts:683 |
| 97 | CANCEL_TARGET | ❌ | Non absorbé — un ciblage abandonné (Fissure sur monstre devenu invalide) laisse le halo à l'écran |
| 100 | PAY_LPCOST | ✅ | session.ts:362 |
| 101 | ADD_COUNTER | ✅ | session.ts:636 |
| 102 | REMOVE_COUNTER | ✅ | session.ts:650 |
| 110 | ATTACK | ✅ | session.ts:785 (journal + combatLog) |
| 111 | BATTLE | ✅ | session.ts:802 |
| 112 | ATTACK_DISABLED | ✅ | session.ts:811 |
| 113 | DAMAGE_STEP_START | ✅ | session.ts:820 |
| 114 | DAMAGE_STEP_END | ✅ | session.ts:829 |
| 120 | MISSED_EFFECT | ✅ | session.ts:838 |
| 121 | BE_CHAIN_TARGET | ❌ | Non absorbé — annonce spécifique de « je deviens cible d'un maillon » (souvent redondant avec BECOME_TARGET, mais Barbaros/Herald l'utilise) |
| 122 | CREATE_RELATION | ❌ | Non absorbé — lien entre deux cartes (Union, XYZ material chain). Impact interface faible, l'état re-query suffit |
| 123 | RELEASE_RELATION | ❌ | Non absorbé — idem inverse |
| 130 | TOSS_COIN | ✅ | session.ts:876 → TossOverlay |
| 131 | TOSS_DICE | ✅ | session.ts:894 |
| 132 | ROCK_PAPER_SCISSORS | ✅ | prompt.ts:540 |
| 133 | HAND_RES | ➖ | Duels en équipe — exclu du périmètre |
| 140 | ANNOUNCE_RACE | ✅ | prompt.ts:495 |
| 141 | ANNOUNCE_ATTRIB | ✅ | prompt.ts:511 |
| 142 | ANNOUNCE_CARD | ✅ | prompt.ts:594 + typeahead |
| 143 | ANNOUNCE_NUMBER | ✅ | prompt.ts:524 |
| 160 | CARD_HINT | ✅ | session.ts:753 |
| 161 | TAG_SWAP | ➖ | Tag duels — exclu |
| 162 | RELOAD_FIELD | ➖ | Debug/serialization — non pertinent, on re-query |
| 163 | AI_NAME | ➖ | IA locale — exclu |
| 164 | SHOW_HINT | ❌ | Non absorbé — bandeau texte libre, rare mais utilisé par Number 39 Utopia et quelques Duel Terminal |
| 165 | PLAYER_HINT | ✅ | session.ts:769 |
| 170 | MATCH_KILL | ➖ | Chaos Emperor Dragon — exclu |
| 180 | CUSTOM_MSG | ➖ | Extension — exclu |
| 190 | REMOVE_CARDS | ❌ | Non absorbé — annonce de suppression massive (Harpie's Feather Duster, Raigeki, Dark Hole…). L'état re-query montre le résultat, mais aucune animation collective |

**Bilan :** ~68/91 utiles absorbés (exclusions §3.3 non comptées). 8 messages
non-absorbés qui pourraient améliorer la narration mais ne bloquent aucune
partie, l'état étant toujours reconstruit par `duelQueryField` /
`duelQueryLocation` après chaque coup (cf. `snapshot.ts:224`).

### 1.2 `OcgResponseType` — 21 valeurs

| Code | Nom | État | Endroit |
|---:|---|:-:|---|
| 0 | SELECT_BATTLECMD | ✅ | prompt.ts:688 |
| 1 | SELECT_IDLECMD | ✅ | prompt.ts:668 |
| 2 | SELECT_EFFECTYN | ✅ | prompt.ts:782 |
| 3 | SELECT_YESNO | ✅ | prompt.ts:785 |
| 4 | SELECT_OPTION | ✅ | prompt.ts:776 |
| 5 | SELECT_CARD | ✅ | prompt.ts:704 |
| 6 | SELECT_CARD_CODES | ✅ | prompt.ts:710 (via `choice.cardCodes`) |
| 7 | SELECT_UNSELECT_CARD | ✅ | prompt.ts:728 |
| 8 | SELECT_CHAIN | ✅ | prompt.ts:744 |
| 9 | SELECT_DISFIELD | ✅ | prompt.ts:751 |
| 10 | SELECT_PLACE | ✅ | prompt.ts:751 |
| 11 | SELECT_POSITION | ✅ | prompt.ts:770 |
| 12 | SELECT_TRIBUTE | ✅ | prompt.ts:721 |
| 13 | SELECT_COUNTER | ✅ | prompt.ts:834 |
| 14 | SELECT_SUM | ✅ | prompt.ts:788 |
| 15 | SORT_CARD | ✅ | prompt.ts:799 |
| 16 | ANNOUNCE_RACE | ✅ | prompt.ts:813 |
| 17 | ANNOUNCE_ATTRIB | ✅ | prompt.ts:821 |
| 18 | ANNOUNCE_CARD | ✅ | prompt.ts:867 (revérification opcodes serveur) |
| 19 | ANNOUNCE_NUMBER | ✅ | prompt.ts:827 |
| 20 | ROCK_PAPER_SCISSORS | ✅ | prompt.ts:807 |

**21 / 21 couverts.** Aucune réponse manquante ; le moteur ne peut pas geler
sur une attente non traitée.

### 1.3 `OcgPosition` — 4 positions + 4 combos

| Bit | Nom | Serveur | Client (web) | Client (mobile) |
|---:|---|:-:|:-:|:-:|
| 0x1 | FACEUP_ATTACK | ✅ prompt.ts:132 | ✅ DuelField.tsx:63 (debout) | ⚠ non typée — juste image |
| 0x2 | FACEDOWN_ATTACK | ✅ | ✅ (verso, debout) | ⚠ affiché « Verso » sans distinction |
| 0x4 | FACEUP_DEFENSE | ✅ | ✅ (couchée, transform:rotate(90deg) DuelField.tsx:306) | ⚠ pas de rotation, juste image debout |
| 0x8 | FACEDOWN_DEFENSE | ✅ | ✅ (verso couchée) | ⚠ « Verso » sans indication couchée |

**Gap client :** le mobile ne distingue pas défense d'attaque visuellement — pas
de rotation 90° pour un monstre en défense. Le joueur ne voit pas d'un coup
d'œil qu'une créature est en défense.

### 1.4 `OcgLocation` — 10 emplacements

| Bit | Nom | Serveur | Web | Mobile |
|---:|---|:-:|:-:|:-:|
| 0x1 | DECK | ✅ snapshot: `deckCount` | ✅ pile | ✅ pile |
| 0x2 | HAND | ✅ (main détaillée pour propriétaire) | ✅ | ✅ |
| 0x4 | MZONE | ✅ (7 slots : 5 + 2 EMZ) | ✅ 5 zones + 2 EMZ centrales (DuelField.tsx:185) | ❌ **5 zones seulement — les 2 EMZ ne sont pas rendues** ([id].tsx:793 : `slice(0, 5)`) |
| 0x8 | SZONE | ✅ (8 slots : 5 + Field + 2 PZone) | ⚠ 5 + Field, **pas de PZone** (DuelField.tsx:197 : rend uniquement spells[5]) | ❌ **5 zones seulement — Field et PZones absents** ([id].tsx:798 : `slice(0, 5)`) |
| 0x10 | GRAVE | ✅ public deux camps | ✅ ouvrable | ✅ ouvrable |
| 0x20 | REMOVED | ✅ (face verso masqué) | ✅ ouvrable (« Bannies ») | ✅ pile |
| 0x40 | EXTRA | ✅ `extraCount` + public YGO | ✅ ouvrable adv. (§C.4) | ✅ pile |
| 0x80 | OVERLAY | ✅ `overlayCards.length` → `materials` | ⚠ compteur affiché mais **noms des matériaux non cliquables** (pourtant publics) | ❌ pas d'affichage matériaux |
| 0x100 | FZONE | ✅ (spells[5]) | ✅ rendu (case Field) | ❌ non rendu |
| 0x200 | PZONE | ✅ dans snapshot | ❌ **non rendu** | ❌ non rendu |

**Gap majeur — Pendulum Zones (PZone) :** un deck Pendulum est ingérable
aujourd'hui. Les cartes posées en zone pendule sont dans le state mais aucun
front ne les affiche. Le joueur voit son échelle disparaître dans le vide.

**Gap important — Extra Monster Zones mobile :** en Master Rule 5 (mode
`MODE_MR5` acté dans `worker.ts:161`), toute invocation Fusion/Synchro/Xyz/Link
via l'Extra Deck doit passer par une EMZ. Non rendues sur mobile = joueur
incapable de comprendre où est son monstre invoqué.

**Gap confort — matériaux Xyz cliquables :** un Xyz montre juste
« 2 matériaux » mais ne dit pas lesquels ; les noms sont publics en YGO.

### 1.5 `OcgOpcode` — 26 opérateurs pour ANNOUNCE_CARD

Le paquet expose `cardMatchesOpcode()` qui gère TOUS les opcodes en interne. Le
code (`prompt.ts:881` et `prompt.ts:928`) l'utilise directement, aussi bien
côté typeahead que côté revérification serveur.

**Couverture : 100 %** — pas de risque de proposer une carte que le moteur
refuserait. Aucune Opcode n'est décodée à la main.

### 1.6 `OcgHintType` — 11 types de hint

| Val | Nom | Utilisation |
|---:|---|---|
| 1 | EVENT | ✅ session.ts:927 → journal `kind:'hint'` |
| 2 | MESSAGE | ✅ session.ts:919 → titre du prochain prompt |
| 3 | SELECTMSG | ✅ session.ts:919 (idem) |
| 4 | OPSELECTED | ✅ session.ts:930 → libellés d'effet pour SELECT_OPTION |
| 5 | EFFECT | ❌ ignoré (session.ts:935) |
| 6 | RACE | ❌ ignoré |
| 7 | ATTRIB | ❌ ignoré |
| 8 | CODE | ❌ ignoré |
| 9 | NUMBER | ❌ ignoré — pourtant utile pour annoncer un compte (« 3 monstres LUMIÈRE ») |
| 10 | CARD | ❌ ignoré |
| 11 | ZONE | ❌ ignoré |

**Gap confort :** 7 types de hint sont muets. L'impact est purement narratif —
un hint `NUMBER` ou `ZONE` bien rendu permettrait des messages du style « il a
retiré 3 marqueurs » ou « il vise ta Zone Monstre 2 ». Aucun ne bloque une
partie.

### 1.7 `OcgHintTiming` — 28 timings d'effets

Ces timings sont émis DANS le message `SELECT_CHAIN` (champs `hint_timing` et
`hint_timing_other`, cf. .d.ts:1160-1161). Ils indiquent au joueur QUEL
timing déclenche cette proposition de chaîne (« au moment de la destruction »,
« après une invocation Spéciale »…).

**État actuel :** `prompt.ts:347-363` construit l'invite SELECT_CHAIN **sans
lire ces deux champs**. Le joueur ne sait pas à quel moment la fenêtre s'ouvre.

**Impact :** faible pour un joueur casual, notable pour un joueur méta (rate le
timing = perd la manche). Aucun blocage dur.

Pour info, les 28 timings sont bien tous prévus par le moteur : DRAW_PHASE,
STANDBY_PHASE, MAIN_END, BATTLE_START, BATTLE_END, END_PHASE, SUMMON,
SPSUMMON, FLIPSUMMON, MSET, SSET, POS_CHANGE, ATTACK, DAMAGE_STEP,
DAMAGE_CAL, CHAIN_END, DRAW, DAMAGE, RECOVER, DESTROY, REMOVE, TOHAND,
TODECK, TOGRAVE, BATTLE_PHASE, EQUIP, BATTLE_STEP_END, BATTLED.

---

## 2. Règles YGO officielles — check exhaustif

**Note préalable :** en `MODE_MR5` (worker.ts:161), le moteur applique
mécaniquement toutes les règles ci-dessous. « ✅ » signifie donc « le moteur le
fait ET le front le rend correctement ». « ❌ » = le moteur le fait mais le
front ne le montre pas.

### 2.1 Types d'invocations

| Type | Moteur | Serveur (session) | Web | Mobile | Notes |
|---|:-:|:-:|:-:|:-:|---|
| Normal Summon (1/tour) | ✅ | ✅ SUMMONING absorbé | ✅ | ✅ | |
| Normal Set | ✅ | ✅ SET absorbé | ✅ | ✅ | |
| Tribute Summon (niv 5-6 = 1 tribut, 7+ = 2) | ✅ | ✅ SELECT_TRIBUTE | ✅ | ✅ | |
| Special Summon | ✅ | ✅ SPSUMMONING | ✅ | ✅ | |
| Ritual Summon | ✅ | ✅ variante `ritual` (session.ts:74-81) | ✅ animation | ⚠ pas de glyphe |
| Fusion Summon | ✅ | ✅ variante `fusion` | ✅ | ⚠ pas de glyphe |
| Synchro Summon | ✅ | ✅ variante `synchro` | ✅ | ⚠ |
| Xyz Summon | ✅ | ✅ variante `xyz` | ✅ + matériaux comptés | ⚠ |
| Pendulum Summon | ✅ | ✅ variante `pendulum` | ❌ **échelle P non rendue** | ❌ **idem** |
| Link Summon | ✅ | ✅ variante `link` | ✅ | ⚠ pas d'EMZ mobile |
| Flip Summon | ✅ | ✅ FLIPSUMMONING/ED | ✅ | ✅ |
| Contact Fusion (Neos, Chimeratech) | ✅ | ✅ (via SPSUMMONING variante fusion) | ✅ | ⚠ |

**Bloquants :** Pendulum Summon inutilisable sur les deux fronts par manque de
zones pendule visibles. Link Summon compréhensible sur web (EMZ visibles) mais
opaque sur mobile.

### 2.2 Positions de monstres

| Règle | État |
|---|:-:|
| Face-up ATK debout | ✅ web / ❌ mobile (pas de convention visuelle) |
| Face-up DEF couchée | ✅ web (rotate 90°) / ❌ mobile |
| Face-down DEF (set) | ✅ dos couché web / ⚠ mobile juste "Verso" |
| Changement de position 1/tour | ✅ moteur (pos_changes dans SELECT_IDLECMD) |
| Xyz/Synchro/Link forcés face-up ATK/DEF | ✅ moteur |

### 2.3 Phases

| Phase | Moteur | Journal | Client |
|---|:-:|:-:|:-:|
| Draw Phase | ✅ | ✅ NEW_PHASE | ✅ label |
| Standby Phase | ✅ | ✅ | ✅ |
| Main 1 | ✅ | ✅ | ✅ SELECT_IDLECMD |
| Battle : Start Step | ✅ | ✅ | ✅ |
| Battle : Battle Step | ✅ | ✅ | ✅ SELECT_BATTLECMD |
| Battle : Damage Step (sub-steps) | ✅ | ✅ DAMAGE_STEP_START/END | ✅ combatLog |
| Battle : End Step | ✅ | ✅ | ✅ |
| Main 2 | ✅ | ✅ | ✅ |
| End Phase | ✅ | ✅ | ✅ |
| Défausse fin de tour > 6 cartes | ✅ moteur (SELECT_CARD auto) | — | — |

**RAS.** Toutes les phases sont annoncées.

### 2.4 Chaînes et Spell Speed

| Règle | État |
|---|:-:|
| Spell Speed 1 (spells normaux, effets ignition) | ✅ moteur |
| Spell Speed 2 (Quick-Play, Trap standard, effets rapides) | ✅ |
| Spell Speed 3 (Counter Trap uniquement) | ✅ |
| SELECT_CHAIN — cartes chaînables filtrées par SS | ✅ prompt.ts:347 |
| Résolution LIFO | ✅ moteur (CHAIN_SOLVING/CHAIN_SOLVED) |
| Compteur chain_size affiché | ✅ session.ts:699, board.chainLength EngineDuelRoom.tsx:524 |
| Missed timing (`When` vs `If`) | ✅ moteur, ✅ MISSED_EFFECT narré combatLog |
| Timing des ouvertures de chaîne (`hint_timing`) | ❌ **ignoré dans prompt.ts:347** |

### 2.5 Battle

| Règle | État |
|---|:-:|
| Attack declaration | ✅ ATTACK absorbé session.ts:785 |
| Replay opportunities (SELECT_CHAIN pendant attaque) | ✅ moteur |
| Damage calculation | ✅ BATTLE + DAMAGE |
| Attaque directe si adversaire sans monstre | ✅ moteur (`can_direct` dans OcgCardLocAttack) |
| Piercing / Trample | ✅ moteur, dégât calculé automatiquement |
| Mirror Force / Sakuretsu → chaîne | ✅ moteur |
| **FIRST_TURN_NO_ATTACK (P1 ne peut pas attaquer T1)** | ✅ défaut MODE_MR5 (le flag `ATTACK_FIRST_TURN` **n'est pas** ajouté au flag mask worker.ts:161) |
| **FIRST_TURN_DRAW (P1 pioche T1)** | ⚠ défaut MODE_MR5 : P1 ne pioche pas. Cohérent avec règle officielle actuelle |

### 2.6 Life Points

| Règle | État |
|---|:-:|
| 8000 par défaut | ✅ paramétrable dans OcgDuelOptionsTeam.startingLP |
| Battle damage | ✅ DAMAGE |
| Effect damage | ✅ DAMAGE |
| Heal (RECOVER) | ✅ |
| LP payés (PAY_LPCOST) | ✅ PAY_LPCOST |
| Passage à 0 = défaite | ✅ moteur émet WIN |
| Match Kill | ➖ hors périmètre (§3.3 plan) |

### 2.7 Cimetière et bannissement

| Règle | État |
|---|:-:|
| Envoi au cimetière | ✅ MOVE / snapshot GRAVE |
| Bannissement face visible | ✅ REMOVED + toView visible |
| Bannissement face cachée | ✅ REMOVED + position facedown, `toView` masque le code (snapshot.ts:108) |
| Retour (Monster Reborn, Return from DD) | ✅ moteur |
| Cimetière/Bannies consultables (public YGO) | ✅ deux camps, deux fronts |

### 2.8 Recouvrement Xyz

| Règle | État |
|---|:-:|
| Matériaux stockés en OVERLAY | ✅ snapshot `overlayCards.length` |
| Compteur matériaux affiché | ✅ `materials` dans DuelCardView |
| **Noms cliquables des matériaux (publics)** | ❌ pas d'UI pour les lister individuellement, alors que `overlayCards` porte les codes |
| Retrait de matériaux (SELECT_COUNTER type overlay) | ⚠ SELECT_COUNTER couvre les Spell Counters ; les Overlay Units passent par un SELECT_CARD ciblant `OVERLAY` — non testé explicitement |

### 2.9 Zones spéciales

| Zone | Moteur | Snapshot | Web | Mobile |
|---|:-:|:-:|:-:|:-:|
| Field Spell Zone (1 / joueur, remplace) | ✅ | ✅ spells[5] | ✅ | ❌ |
| EMZ (2 partagées) | ✅ | ✅ monsters[5,6] | ✅ (au centre, DuelField.tsx:185) | ❌ |
| Pendulum Zones (gauche/droite) | ✅ | ✅ spells[6,7] | ❌ | ❌ |

### 2.10 Deck construction

| Règle | Enforcement | Endroit |
|---|:-:|---|
| Main Deck 40-60 | ✅ | deckLoader.ts:197-198 |
| Extra Deck ≤ 15 | ✅ | deckLoader.ts:199 |
| Side Deck ≤ 15 | ⚠ back Bo3 stocke, pas de check strict côté deckLoader |
| Max 3 exemplaires par carte | ❌ **non vérifié** — un joueur peut soumettre 40x Pot of Greed |
| Banlist (Forbidden = 0, Limited = 1, Semi-Limited = 2) | ❌ **non implémenté** — cf. F7 du plan, non fait |
| Cartes Extra dans Main Deck refusées | ✅ deckLoader.ts:38 (`is_extra_deck` réclassifié via type réel) |

**Bloquants tournois :** F7 (banlist + max 3) doit être fait avant tout usage
compétitif.

### 2.11 Autres règles

| Règle | État |
|---|---|
| Défausse End Phase si > 6 | ✅ moteur (SELECT_CARD sur `HAND`) |
| Time out | ✅ F5 chess-clock (Bloc 2, `duel_clocks` migration 011) |
| Deck out (pioche vide = défaite) | ✅ moteur émet WIN reason=2 (session.ts:138) |
| FIRST_TURN_NO_ATTACK | ✅ défaut MR5 |
| CANNOT_ATTACK effects (Marshmallon, etc.) | ✅ moteur (n'apparaît pas dans `attacks` de SELECT_BATTLECMD) |
| Pile ou face + choix P1/P2 | ✅ F1 (pre-game, migration 010) |
| Abandon | ✅ F2 |
| Match Bo3 + Side Deck | ✅ web F4 / ⚠ mobile non porté |
| Reprise après reboot | ✅ F6 (rehydrate.ts) |
| Spectateurs | ✅ F7 web+mobile |

---

## 3. Interface — cas d'usage

### 3.1 Prompts → rendu

| Prompt | Rendu web | Rendu mobile | Portée | Non-fuite | Annuler |
|---|:-:|:-:|:-:|:-:|:-:|
| SELECT_IDLECMD | ✅ menu carte + rail | ✅ | — | ✅ | — |
| SELECT_BATTLECMD | ✅ | ✅ | — | ✅ | — |
| SELECT_CARD | ✅ modal + halo plateau | ✅ | ✅ §C.2 web+mobile | ✅ | ✅ (canCancel) |
| SELECT_TRIBUTE | ✅ multi-select accumulation | ✅ | ✅ | ✅ | ✅ |
| SELECT_UNSELECT_CARD | ✅ | ✅ | ✅ | ✅ | ✅ |
| SELECT_CHAIN | ✅ | ✅ | — | ✅ | ✅ |
| SELECT_PLACE | ✅ cases plateau surlignées | ⚠ **pas de plateau interactif** — impossible de désigner une case | — | ✅ | ❌ |
| SELECT_DISFIELD | ✅ | ⚠ idem | — | ✅ | ❌ |
| SELECT_POSITION | ✅ modal 4 positions | ✅ | — | ✅ | ❌ |
| SELECT_OPTION | ✅ libellés via HINT | ✅ | — | ✅ | ❌ |
| SELECT_EFFECTYN | ✅ yes/no + nom carte | ✅ | — | ✅ | ❌ |
| SELECT_YESNO | ✅ | ✅ | — | ✅ | ❌ |
| SELECT_SUM | ✅ | ✅ | ✅ montant affiché | ✅ | ❌ |
| SORT_CARD | ✅ | ✅ | ✅ | ✅ | ✅ |
| SORT_CHAIN | ✅ | ✅ | ✅ | ✅ | ✅ |
| SELECT_COUNTER | ✅ curseurs + total | ✅ | ✅ | ✅ | ❌ |
| ANNOUNCE_RACE | ✅ chips masque | ✅ | ✅ count | ✅ | ❌ |
| ANNOUNCE_ATTRIB | ✅ | ✅ | ✅ | ✅ | ❌ |
| ANNOUNCE_NUMBER | ✅ liste | ✅ | — | ✅ | ❌ |
| ANNOUNCE_CARD | ✅ typeahead | ✅ | — | ✅ | ❌ |
| ROCK_PAPER_SCISSORS | ✅ 3 boutons | ✅ | — | ✅ | ❌ |
| **unsupported** | ✅ affiché tel quel | ✅ | — | ✅ | ✅ |

**Gap bloquant mobile :** SELECT_PLACE et SELECT_DISFIELD demandent au joueur
de désigner une case libre. Sur web, on clique la case sur le plateau. Sur
mobile, le plateau est en lecture seule (`Zone` component [id].tsx:821 ne gère
que `onTap`, sans notion de « case placeable ») — **impossible de poser une
carte**.

### 3.2 États de plateau — rendu

Vérifié dans `DuelField.tsx` (web) et `[id].tsx:771 BoardSide` (mobile) :

| Élément | Web | Mobile |
|---|:-:|:-:|
| Nom de la carte au survol/tap | ✅ HoverCard | ✅ detailCard modal |
| ATK/DEF | ✅ | ⚠ dans detailCard uniquement, pas sur la case |
| Position visuelle (couché/debout) | ✅ | ❌ |
| Marqueurs (compteurs) en surimpression | ⚠ `counters` dans DuelCardView mais aucun render explicite trouvé | ❌ |
| Effets équipés (lien visuel) | ⚠ EQUIP absorbé mais aucun trait tracé | ❌ |
| Cibles en cours (halo) | ✅ BECOME_TARGET + AnimationLayer | ❌ AnimationLayer non porté ? à vérifier |
| Chaîne en cours (liste des cartes) | ⚠ `board.chainLength` affiché mais **pas la liste des cartes de la chaîne** (pourtant `field.chain` de OcgFieldState est dispo) | ❌ juste le nombre |
| LP + chrono deux joueurs | ✅ LifePoints + ClockDisplay | ✅ ClockPill |
| Phase + tour + joueur actif | ✅ header | ✅ header |
| Cimetière deux camps | ✅ | ✅ |
| Extra Deck deux camps | ✅ §C.4 | ✅ |
| Bannies deux camps | ✅ | ✅ |

**Gap important :** la chaîne en cours n'expose pas la liste des cartes
empilées, alors que `duelQueryField()` retourne `chain: OcgChain[]` avec les
positions et descriptions. Le joueur voit « chaîne · 3 » sans savoir quels
effets s'enchaînent.

**Gap important :** les marqueurs (`counters` déjà dans DuelCardView) ne sont
rendus visuellement nulle part. Pour un deck qui vit sur les marqueurs (Spell
Counter, Ice Barrier), c'est un manque significatif.

### 3.3 Menu contextuel bufferisé (§4bis)

Validé côté serveur (session.ts:1066 filtre prompt au seat) et client
(CardActionMenu web + mobile). Le test `auditNoLeakDuringActivationMenu`
(cf. §8bis du plan) confirme 0 fuite sur 5 parties autoplay.

---

## 4. Mobile — passage en landscape

### 4.1 État actuel

Fichier : `c:\laragon\www\New-YugiohCollection\mobile\app.json:6`
```json
"orientation": "portrait",
```

Dépendances installées (grep sur mobile/package.json) :
- **`expo-screen-orientation` NON installé.**
- Aucune référence à `OrientationLock`, `lockAsync` ou similaire dans
  `mobile/src/`.

L'arène moteur (`mobile/src/app/duel/engine/[id].tsx`, 1916 lignes) est
structurée pour un portrait :
- SafeAreaView + ScrollView vertical
- BoardSide adverse en haut, BoardSide joueur en bas ([id].tsx:385-402)
- Prompt modal centré
- Header horizontal simple

### 4.2 Ce qui doit changer pour landscape

Le user impose landscape obligatoire pour les duels. Deux niveaux :

**Niveau 1 — Verrou d'orientation.** Deux options techniques :
1. Poser `"orientation": "landscape"` dans `app.json` — verrouille l'app
   entière, casse toutes les autres écrans en portrait. **Refusé.**
2. Installer `expo-screen-orientation` et appeler `lockAsync(LANDSCAPE)` à
   l'entrée du duel + `unlockAsync()` à la sortie. **Voie retenue.**
   Compatible SDK 54 (le plan §mobile_expo_sdk54 mémoire user), API stable.

**Niveau 2 — Layout à refaire.** Le layout portrait actuel doit devenir un
miroir web horizontal :
- Deux plateaux côte-à-côte n'est PAS la disposition YGO. La bonne est un
  plateau **retourné en miroir** (adversaire en haut, joueur en bas) mais avec
  toutes les zones visibles en même temps sans scroll.
- Plateau doit tenir dans une largeur qui garantit 7 colonnes × 2 rangées ×
  2 camps + EMZ centrale, soit ~14 hauteurs de carte. En landscape 812×375
  (iPhone SE) : cartes de ~50-60 px de large, faisable.
- Le chrono, le journal, les modals doivent être repensés (drawer latéral au
  lieu de sheet bas).
- La main doit rester scrollable horizontalement en bas, sans manger de
  hauteur pour le plateau.
- Le HoverCard/detail doit basculer en side-panel (à droite).

**Composants à basculer / réécrire :**
- `BoardSide` ([id].tsx:771) → deux passages verticaux dans un flex row
- `ClockPill`, `TossOverlay`, `RevealOverlay`, `CombatLogFeed`, `AnimationLayer`
  (probablement non portés — à vérifier) → drawer / side
- `PromptModal` (ligne 908 et suivantes) → bottom sheet compact, garder les
  choix accessibles au pouce
- **Ajouter le rendu des EMZ, Field Spell Zone, Pendulum Zones** — cf. §1.4
- **Ajouter la rotation 90° pour les monstres en défense** — cf. §1.3
- **Rendre le plateau interactif pour SELECT_PLACE / SELECT_DISFIELD** — cf. §3.1

---

## 5. Gaps identifiés — priorisés

> **Mise à jour 2026-08-04 · Bloc 6 livré.** Cases cochées = résolues dans le
> push Bloc 6. Voir `PLAN-DUEL-AMELIORATIONS.md §10` pour le détail des
> livrables.

### 5.1 Bloquants (partie impossible dans certains cas)

1. [x] **Pendulum Zones invisibles sur les deux fronts.** Résolu (C1) : les 2
   PZones sont désormais rendues web + mobile, bordure violette, badge « P »
   sur la carte posée, bannière « Invocation Pendulum possible » quand les
   deux slots sont occupés.

2. [x] **Mobile — plateau non interactif pour SELECT_PLACE / SELECT_DISFIELD.**
   Résolu (C2) : `ZoneSlot` accepte les options du prompt courant, surligne les
   cases valides (cyan pour pose, doré pour cible) et déclenche `send` au tap.

3. [x] **Mobile — Extra Monster Zones absentes.** Résolu (C2) : composant
   `ExtraMonsterZones` entre les deux camps, EMZ partagées, interactives.

4. [x] **Mobile — Field Spell Zone absente.** Résolu (C2) : rendue dans la
   colonne latérale du camp (haut), bordure verte spécifique.

5. [x] **Mobile — orientation portrait imposée.** Résolu (C2) :
   `expo-screen-orientation` installé, `lockAsync(LANDSCAPE)` posé sur les 3
   écrans duel (moteur, manuel, spectateur), unlock en cleanup.

6. [x] **Deck construction — max 3 exemplaires + banlist non enforced.**
   Résolu (C5) : `checkEngineDeckStrict` bloque au `start` du duel côté
   serveur, endpoint `POST /duels/:id/engine/validate-deck` ajouté, badge
   temps réel dans `DeckEditor` web.

### 5.2 Importants (partie possible mais compréhension limitée)

7. [x] **Mobile — position visuelle des monstres.** Résolu (C2) : monstre en
   défense = image tournée 90° dans la case. Face-verso reste marqué « Verso »
   / « Verso DEF ».

8. [x] **Chaîne en cours — liste des cartes non affichée.** Résolu (C4) :
   `DuelBoardView.chain` (nouveau) + composants `ChainPanel` (web) et
   `ChainPanelMobile` (mobile), maillon en résolution surligné doré.

9. [x] **Marqueurs sur les cartes — non rendus.** Résolu (C3) : badge doré en
   bas-droite de chaque case, total tous types cumulés.

10. [ ] **Effets équipés — pas de trait visuel.** Non résolu (report v1.1) :
    l'animation `EQUIP` transitoire reste seule ; le trait SVG permanent
    demandera d'exposer un `equippedTo` dans le snapshot.

11. [x] **`hint_timing` dans SELECT_CHAIN ignoré.** Résolu (C7) : décodé et
    transmis comme `hint.note` sur le prompt chain (« Fenêtre : Fin de la
    Battle Phase, Après destruction »).

12. [x] **Mobile — AnimationLayer / CombatLogFeed / RevealOverlay / TossOverlay
    portage à vérifier.** Vérifié : ces composants EXISTENT bien dans le
    fichier mobile actuel (extraits `state.animations`, `combatLog`, `reveals`,
    `tosses` sont utilisés). Rien à faire.

13. [x] **Matériaux Xyz non listables.** Résolu partiellement (C3) : badge cyan
    « Xn » sur la carte Xyz (haut-gauche). Ouverture d'un modal avec les noms
    individuels = report v1.1 (P2.b).

### 5.3 Confort (nice-to-have)

14. [x] Messages non absorbés : tous résolus (C6) — `SHOW_HINT`,
    `SWAP_GRAVE_DECK`, `SHUFFLE_SET_CARD`, `REVERSE_DECK`, `CARD_SELECTED`,
    `RANDOM_SELECTED`, `CANCEL_TARGET`, `BE_CHAIN_TARGET`, `CREATE_RELATION`,
    `RELEASE_RELATION`, `REMOVE_CARDS`, `START` — chacun a désormais son
    entrée `log` ou `combatLog`.

15. [x] Hints ignorés : tous résolus (C7) — `EFFECT` → note du prompt courant,
    `CARD` → journal + anim `card_hint`, `ZONE` / `NUMBER` / `RACE` / `ATTRIB`
    / `CODE` → entrée journal typée.

16. [x] Message `START` : résolu (C6) — journal « Partie démarrée ».

17. [ ] Web — pas de son / vibration au passage sous 30 s (non couvert).

18. [ ] Backfill `strings-fr.conf` — reste à faire côté opérateur.

---

## 6. Recommandations pour Bloc 6 (à implémenter)

### 6.1 Priorité 1 — obligatoires pour push v1 complet

**P1.a — Rendre les Pendulum Zones sur les deux fronts.**
- `client/src/components/duel/DuelField.tsx` : ajouter deux cases pour
  `spells[6]` (P-gauche) et `spells[7]` (P-droite), une par côté de la rangée
  Field. Suivre la disposition YGO officielle : les zones P encadrent la
  rangée Magie/Piège (ou sont dans les cases 0 et 4 de la SZone selon les
  Master Rules — MR5 les met en positions dédiées).
- Miroir mobile.
- Estimation : 3-4 h web + inclus dans P1.d mobile.

**P1.b — Enforcement banlist + limite 3 exemplaires.**
- `server/src/services/duelEngine/deckLoader.ts` : ajouter check `count(code) <= 3`
  par carte (sauf tokens).
- Créer service `banlistService` qui lit `lflist.conf` d'EDOPro ou reconstruit
  depuis `cards.banlist_info` (déjà en base, cf. ygoprodeckService.ts:428).
- Refuser au load : « Snake-Eye Ash : Limité (max 1), tu en as 3 ».
- Estimation : 4-6 h.

**P1.c — Mobile : verrou landscape + refonte layout arène moteur.**
- `npm install expo-screen-orientation@~7.0.0` (SDK 54).
- Hook `useEffect` à l'entrée de `[id].tsx` : `lockAsync(LANDSCAPE)` /
  `unlockAsync()` au unmount.
- Refonte `BoardSide` en flex row miroir web (adversaire haut retourné,
  joueur bas).
- Ajout **EMZ, Field Spell, Pendulum Zones, rotation défense, marqueurs
  visuels**.
- **Rendre le plateau cliquable pour SELECT_PLACE / SELECT_DISFIELD** — passer
  les options du prompt à `BoardSide` et surligner les cases (voir DuelField
  web pour la logique `placeable`).
- Vérifier / porter `AnimationLayer`, `CombatLogFeed`, `RevealOverlay`,
  `TossOverlay`, `HoverCard` en versions adaptées à un side-panel.
- Estimation : 12-16 h (le plus gros du bloc).

**P1.d — Chaîne : afficher la liste des cartes empilées.**
- `snapshot.ts` : ajouter `chain: DuelChainEntry[]` à `DuelBoardView` en
  lisant `field.chain` de `duelQueryField()`.
- `EngineDuelRoom.tsx` : afficher un rail à côté de « chaîne · N » avec les
  vignettes des cartes en cours de résolution (ordre = ordre d'activation,
  la résolution se fera en LIFO).
- Miroir mobile.
- Estimation : 3-4 h.

**P1.e — Marqueurs rendus visuellement sur les cartes.**
- Composant `<CounterBadges counters={card.counters} />` en surimpression
  d'une case de plateau. Résoudre le nom via `counterString()` déjà utilisé
  dans prompt.ts:570.
- Web + mobile.
- Estimation : 2-3 h.

**P1.f — Position visuelle des monstres mobile.**
- Rotation 90° pour `(position & 0xc) !== 0` dans le composant `Zone` mobile.
- Cadre distinct pour verso ATK vs verso DEF (rare mais existe).
- Estimation : 1-2 h.

### 6.2 Priorité 2 — peut attendre v1.1

**P2.a — `hint_timing` dans SELECT_CHAIN.**
- `prompt.ts:347` : décoder `m.hint_timing` (mask OcgHintTiming) via
  `ocgHintTimingParse` et l'afficher (« Fenêtre ouverte : destruction, envoi
  au cimetière »).
- Estimation : 2 h.

**P2.b — Matériaux Xyz cliquables.**
- Étendre `DuelCardView` avec `materialCodes?: number[]` (lu depuis
  `overlayCards`), afficher au tap.
- Estimation : 2 h.

**P2.c — Effets équipés — lien permanent.**
- Extraire les liens `EQUIP` via `duelQuery` avec `EQUIP_CARD` flag, tracer
  un trait SVG entre les deux cases.
- Estimation : 3-4 h.

**P2.d — Messages non absorbés à impact narratif.**
- `CARD_SELECTED`, `RANDOM_SELECTED`, `SHOW_HINT`, `REMOVE_CARDS` — ajouts
  ponctuels dans `session.absorb`.
- Estimation : 3 h cumulé.

**P2.e — Hints ignorés.**
- Cas `NUMBER`, `ZONE`, `CARD`, `RACE`, `ATTRIB` dans `session.ts:935` —
  décoder et pousser dans le journal si utile.
- Estimation : 2-3 h.

**P2.f — Mobile — F4 Match Bo3 + F7 découverte spectateurs.**
- Reports assumés du Bloc 5 (§9.8 plan).
- Estimation : 6-8 h.

**P2.g — Backfill `strings-fr.conf`.**
- Récupérer un `strings.conf` EN de EDOPro à la main, lancer
  `npm run duel:backfill-hints-fr`.
- Estimation : 1 h opérateur.

---

## Références clés (chemins absolus)

- `c:\laragon\www\New-YugiohCollection\server\node_modules\ocgcore-wasm\dist\index.d.ts`
  (2195 lignes — enums)
- `c:\laragon\www\New-YugiohCollection\server\src\services\duelEngine\session.ts:284-950`
  (absorption messages)
- `c:\laragon\www\New-YugiohCollection\server\src\services\duelEngine\prompt.ts:208-933`
  (traduction prompts + réponses + typeahead)
- `c:\laragon\www\New-YugiohCollection\server\src\services\duelEngine\snapshot.ts:224-254`
  (buildBoardView)
- `c:\laragon\www\New-YugiohCollection\server\src\services\duelEngine\worker.ts:161`
  (`MODE_MR5` retenu)
- `c:\laragon\www\New-YugiohCollection\server\src\services\duelEngine\deckLoader.ts:197-199`
  (check tailles deck)
- `c:\laragon\www\New-YugiohCollection\shared\duelView.ts:35-477` (contrat client)
- `c:\laragon\www\New-YugiohCollection\client\src\pages\EngineDuelRoom.tsx:1-1099`
  (arène web)
- `c:\laragon\www\New-YugiohCollection\client\src\components\duel\DuelField.tsx:1-329`
  (plateau web, PZone manquantes)
- `c:\laragon\www\New-YugiohCollection\mobile\src\app\duel\engine\[id].tsx:1-1916`
  (arène mobile portrait)
- `c:\laragon\www\New-YugiohCollection\mobile\app.json:6` (`"orientation": "portrait"`)
- `c:\laragon\www\New-YugiohCollection\mobile\package.json` (**pas** de
  `expo-screen-orientation`)
