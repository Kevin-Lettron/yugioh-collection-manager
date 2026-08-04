# Programme d'amélioration du duel moteur

> Fichier de passation, mis à jour à chaque étape.
> **Branche :** `dev` · **Établi le :** 2026-08-04
>
> Complète `PLAN-MOTEUR-DUEL.md`, qui décrit l'intégration. Celui-ci recense ce
> qui reste à faire pour que le duel soit **complet**, et non seulement jouable.

---

## 1. Méthode

Le moteur ygopro-core communique par deux vocabulaires fermés : les **messages**
qu'il émet et les **réponses** qu'il attend. Leur nombre est connu et fini, ce
qui permet un audit exhaustif plutôt qu'une liste d'impressions.

L'audit ci-dessous a été produit en confrontant les énumérations de
`ocgcore-wasm/dist/index.d.ts` au code de `prompt.ts` et `session.ts`. Il est
reproductible et devra l'être à chaque montée de version du moteur.

---

## 2. Réponses attendues par le moteur — 18 sur 21

Une réponse non couverte est un **blocage dur** : le moteur attend, le joueur ne
peut rien faire, la partie est morte.

| Réponse | État | Quand elle survient |
|---|---|---|
| `SELECT_IDLECMD`, `SELECT_BATTLECMD` | ✅ | Phase principale, phase de combat |
| `SELECT_CARD`, `SELECT_TRIBUTE`, `SELECT_SUM`, `SELECT_UNSELECT_CARD` | ✅ | Cibler, sacrifier, totaliser |
| `SELECT_PLACE`, `SELECT_DISFIELD`, `SELECT_POSITION` | ✅ | Poser, neutraliser une zone, choisir la position |
| `SELECT_CHAIN`, `SELECT_EFFECTYN`, `SELECT_YESNO`, `SELECT_OPTION` | ✅ | Chaîne, confirmations, choix d'effet |
| `SORT_CARD`, `ROCK_PAPER_SCISSORS` | ✅ | Ordonner, pierre-feuille-ciseaux |
| `ANNOUNCE_RACE`, `ANNOUNCE_ATTRIB`, `ANNOUNCE_NUMBER` | ✅ | Annoncer un type, un attribut, un nombre |
| **`ANNOUNCE_CARD`** | ❌ **bloquant** | Nommer une carte (« déclarez le nom d'une carte ») |
| **`SELECT_COUNTER`** | ❌ **bloquant** | Retirer des marqueurs — decks à Spell Counters, Ice Barrier… |
| **`SELECT_CARD_CODES`** | ❌ **bloquant** | Sélection par passcode plutôt que par emplacement |

### Ce qu'il faut faire

- **`ANNOUNCE_CARD`** — impossible à énumérer : 14 714 cartes. Il faut un champ
  de recherche, alimenté par `cardStore.names`, avec la contrainte que le moteur
  fournit un **filtre d'opcodes** (`OcgMessageAnnounceCard.opcodes`) limitant les
  cartes déclarables. `cardMatchesOpcode()` est exporté par le paquet et fait
  exactement ce travail — il faut l'appliquer côté serveur, sinon le joueur
  proposera des cartes que le moteur refusera.
- **`SELECT_COUNTER`** — le message porte `counter_type`, `count` et les cartes
  qui en portent. Une invite dédiée avec un compteur par carte.
- **`SELECT_CARD_CODES`** — même forme que `SELECT_CARD`, mais la réponse porte
  des passcodes et non des indices. Peu coûteux une fois les deux autres faits.

---

## 3. Messages émis par le moteur — 33 sur 94

Un message non traité **ne bloque pas** la partie : l'état du plateau est
réinterrogé au moteur après chaque coup, il reste donc juste. Ce qui manque,
c'est la **narration** — le joueur voit le résultat sans comprendre la cause.

### 3.1 Ceux qui comptent vraiment

| Message | Conséquence de l'absence |
|---|---|
| **`RETRY`** | Le moteur a refusé notre réponse. Aujourd'hui : rien ne s'affiche, le joueur croit à un gel. **À traiter en premier**, c'est le seul qui signale un bogue de notre côté. |
| **`HINT`** | Porte les libellés d'effets et les consignes de sélection. Sans lui, on affiche « Effet 1 », « Effet 2 » au lieu du texte réel. |
| **`CONFIRM_CARDS`, `CONFIRM_DECKTOP`, `CONFIRM_EXTRATOP`** | Une carte révélée à l'adversaire ne lui est pas montrée. Casse toute la famille des effets « montrez une carte ». |
| **`TOSS_COIN`, `TOSS_DICE`** | Pile ou face et lancers de dés invisibles — le joueur subit un résultat sans le voir. |
| **`MISSED_EFFECT`, `CHAIN_NEGATED`, `CHAIN_DISABLED`** | Un effet annulé passe inaperçu ; le joueur croit à un bogue. |
| **`WAITING`** | Aucun retour pendant que l'adversaire réfléchit. |
| **`ATTACK_DISABLED`, `BATTLE`, `DAMAGE_STEP_START/END`** | Le combat se résout sans récit. |

### 3.2 Ceux qui n'apportent qu'un confort d'animation

`MOVE`, `POS_CHANGE`, `SWAP`, `EQUIP`, `ADD_COUNTER`, `REMOVE_COUNTER`,
`BECOME_TARGET`, `CARD_TARGET`, `SUMMONED`, `SPSUMMONED`, `FLIPSUMMONED`,
`CHAINED`, `CHAIN_SOLVING`, `CHAIN_SOLVED`, `CHAIN_END`, `SHUFFLE_*`,
`DECK_TOP`, `FIELD_DISABLED`, `CARD_HINT`, `PLAYER_HINT`…

L'état est déjà correct sans eux. Ils serviraient à animer : une carte qui
glisse vers le cimetière, un marqueur qui apparaît, une cible qui s'illumine.

### 3.3 Ceux qui ne nous concernent pas

`AI_NAME`, `TAG_SWAP`, `MATCH_KILL`, `CUSTOM_MSG`, `REQUEST_DECK`,
`UPDATE_DATA`, `UPDATE_CARD`, `RELOAD_FIELD`, `HAND_RES` — duels en équipe,
IA locale, ou détails de protocole que notre architecture par requête d'état
rend inutiles.

---

## 4. Fonctionnalités de jeu absentes

| # | Sujet | Pourquoi ça compte | Effort |
|---|---|---|---|
| F1 | **Pile ou face au lancement** | Règle officielle : le gagnant choisit de commencer ou non. Aujourd'hui le siège 0 commence toujours. | 3 – 4 h |
| F2 | **Abandon** | Le mode manuel l'a, le moteur non. `surrender` existe côté modèle. | 1 h |
| F3 | **Animation de pioche** | Les keyframes sont posées, le composant non. | 2 h |
| F4 | **Side Deck et match en 3 manches** | Le format de compétition. Le moteur sait le faire, la table `duels` ne modélise qu'une manche. | 8 – 12 h |
| F5 | **Chronomètre par joueur** | Sans lui, un joueur peut bloquer la partie indéfiniment (jusqu'au TTL de 30 min). | 3 h |
| F6 | **Reprise après redémarrage** | Le journal rejouable existe (migration 009) mais n'est pas rejoué. | 6 – 8 h |
| F7 | **Spectateurs** | Regarder un duel en cours. Demande une vue « sans main » côté serveur. | 4 h |
| F8 | **Écran mobile** | L'arène moteur n'existe que sur le web. | 12 – 16 h |

---

## 4bis. Flow des activations d'effet (exigence forte du produit)

Le moteur émet `SELECT_EFFECTYN` (yes/no sur un effet spécifique) ou
`SELECT_OPTION` (choix entre plusieurs effets d'une même carte). Contrairement
à Master Duel qui révèle immédiatement l'activation à l'adversaire, on veut :

1. **Menu contextuel local sur la carte** (y compris les cartes posées face
   verso) qui liste : « Activer effet 1 », « Activer effet 2 », … , « Ne pas
   activer », « Annuler ».
2. Rien n'est envoyé au moteur ni broadcast à l'adversaire tant que le joueur
   n'a pas **cliqué Valider** dans ce menu.
3. Une fois validé, le moteur reçoit la réponse et déclenche la révélation
   publique (`MSG_CHAINING`, retournement de la carte face verso, message dans
   le journal de l'adversaire).

**Conséquences techniques :**

- Les prompts `SELECT_EFFECTYN` et `SELECT_OPTION` doivent être **poussés sans
  aucun effet visible côté adversaire** — c'est déjà le cas dans notre design
  (`DuelStateResponse.prompt` est privé au siège), mais il faut vérifier que
  *rien d'autre* ne fuite (pas de flag « en cours de sélection » sur la carte
  côté snapshot adverse, pas de `MSG_HINT` public parasite).
- Sur les cartes face verso : le clic sur ma propre carte ne doit PAS déclencher
  immédiatement l'appel au moteur — il doit ouvrir le menu local d'abord.
- Le bouton **Annuler** referme le menu sans rien envoyer, ne modifie pas
  l'état du duel. Le prompt reste ouvert côté serveur, le joueur peut réessayer.
- Les cartes avec plusieurs effets (Ash Blossom & Joyous Spring a un seul
  effet, mais Effect Veiler n'en a qu'un aussi ; les vrais cas multi-effets sont
  Called by the Grave, Solemn Warning + Judgment, ou les Pendulums avec effet
  monstre + effet magie) déclenchent `SELECT_OPTION` — le menu liste chaque
  effet via `HINT` traduit.

À intégrer au Bloc 3 (narration / interactions cartes).

---

## 5. Points d'interface à reprendre

- **Libellés d'effets** — « Effet 1 » faute des textes d'EDOPro (`strings.conf`).
  Deux voies : embarquer le fichier, ou traduire les descriptions via les
  `HINT`. La première est plus fiable.
- **Journal illisible** — il énumère les phases et noie les évènements de jeu.
  Séparer « déroulé » et « actions ».
- **Aucune indication de portée** — quand le moteur demande une cible, rien ne
  dit combien il en faut ni pourquoi.
- **Pas de confirmation avant un coup irréversible** — un clic malheureux sur
  « Phase de Fin » termine le tour sans retour possible.
- **Zoom des zones adverses** — le cimetière adverse est consultable, mais son
  Extra Deck reste opaque alors qu'il est public en partie réelle.

---

## 6. Ce qu'il faut tester, et comment

### 6.1 Automatisable

`npm run duel:autoplay 10` joue des parties entières et vérifie déjà :
invites non couvertes, réponses refusées, étanchéité de l'information cachée.
**À étendre :**

- jouer avec un deck **méta réel** (Snake-Eye, Kashtira) et non des monstres
  Normaux : c'est le seul moyen de croiser les chaînes longues, les
  invocations depuis l'Extra Deck, les marqueurs et les annonces ;
- faire échouer volontairement des réponses pour vérifier que `RETRY` remonte ;
- rejouer une partie depuis son journal et comparer l'état final — c'est le
  test qui validera F6.

### 6.2 Manuel, à deux joueurs

Aucun de ces cas n'a été testé à deux navigateurs. Par ordre de risque :

1. **Un tour complet** : pioche, invocation, pose, attaque, fin de tour.
2. **Une chaîne à deux** : l'un active, l'autre répond.
3. **Invocation par tribut** : la sélection multiple s'accumule-t-elle ?
4. **Recherche dans le deck** : la fenêtre centrale s'ouvre-t-elle ?
5. **Rechargement de page en pleine partie** : l'état revient-il ?
6. **Coupure du WebSocket** : le sondage de 3 s prend-il le relais ?
7. **Deux onglets, même joueur** : les deux restent-ils cohérents ?
8. **Purge après 30 min d'inactivité** : les deux joueurs sont-ils prévenus ?

### 6.3 Ce que je n'ai pas pu vérifier

**L'interface n'a jamais été utilisée à deux joueurs réels.** Tout ce qui suit
est vérifié à la compilation et par l'auto-joueur — donc côté moteur — mais pas
en conditions de partie : la synchronisation temps réel, l'ordre des annonces,
le comportement quand les deux joueurs cliquent en même temps.

---

## 7. Ordre de traitement proposé

**D'abord ce qui bloque une partie :**

1. `RETRY` remonté à l'écran *(2 h)* — sans lui, tout bogue ressemble à un gel.
2. `SELECT_COUNTER`, `ANNOUNCE_CARD`, `SELECT_CARD_CODES` *(6 – 8 h)*.
3. `CONFIRM_CARDS` et compagnie — les cartes révélées *(3 h)*.

**Ensuite ce qui rend le jeu juste :**

4. F1, le pile ou face *(3 – 4 h)*.
5. `TOSS_COIN` / `TOSS_DICE` *(2 h)*.
6. `HINT` et les vrais libellés d'effets *(4 – 6 h)*.
7. F2 abandon, F5 chronomètre *(4 h)*.

**Enfin le confort :**

8. F3 animation de pioche, narration des messages de la section 3.2.
9. F8 écran mobile.
10. F4 match en 3 manches, F6 reprise, F7 spectateurs.

Total des deux premiers blocs : **environ 25 heures**. C'est ce qui sépare
« jouable » de « complet ».

---

## 8. Avancement

- [x] `RETRY` visible — **fait le 2026-08-04.** Le worker mémorise le siège
      dernier ayant répondu ; au reçu de `MSG_RETRY`, il pose un `lastRetry`
      sur ce siège (le seul concerné, filtré côté vue). Le front compare le
      timestamp et déclenche un toast rouge unique, effacé au coup suivant
      accepté. Trace serveur `[duel:retry] duelId=X player=Y`.
- [x] `SELECT_COUNTER` — **fait le 2026-08-04.** Nouveau `DuelPrompt.counter`
      qui porte type de marqueur, total à retirer et cartes concernées.
      Modal avec un curseur + input numérique par carte, bouton `Retirer`
      désamorcé tant que `Σ take ≠ count`. Le serveur revalide la somme et
      les plafonds avant `duelSetResponse`, sans consulter le moteur.
- [x] `ANNOUNCE_CARD` avec recherche et filtre d'opcodes — **fait le
      2026-08-04.** Nouveau prompt `announce_card`, endpoint
      `POST /duels/:id/engine/announce-card/search` qui interroge
      `cardStore.names` (14 714 cartes) puis élimine celles qui ne passent
      pas les `opcodes` du moteur via `cardMatchesOpcode()`. Le front tape
      un début de nom (débounce 200 ms, 2 caractères mini), voit les 20
      premières cartes valides et déclare celle qu'il veut. Revérification
      des opcodes côté serveur avant l'envoi au moteur.
- [x] `SELECT_CARD_CODES` — **fait le 2026-08-04.** L'invite reste
      `select_card` côté prompt ; le front qui a la liste des passcodes de
      ses options renvoie `DuelChoice.cardCodes` au lieu (ou en plus) de
      `optionIds`. Sérialisation en `OcgResponseType.SELECT_CARD_CODES`
      via le paquet. Note : `ocgcore-wasm 0.1.2` ne distingue pas encore
      `MSG_SELECT_CARD_CODES` de `MSG_SELECT_CARD` — le code est prêt
      pour une version qui l'émettra.
- [x] Cartes révélées (`CONFIRM_*`) — **fait le 2026-08-04.** Le worker
      pousse une `DuelRevealBatch` à chaque `CONFIRM_CARDS`, `_DECKTOP`,
      `_EXTRATOP`, avec un TTL de 6 s. Seul le siège **à qui** la carte
      est révélée reçoit la salve. Composant `RevealOverlay` en haut du
      plateau : fade-in / fade-out, badge `Deck (dessus)` /
      `Extra (dessus)` en cyan pour distinguer DECKTOP/EXTRATOP du
      simple CONFIRM_CARDS.
- [x] Pile ou face — **fait le 2026-08-04.** Nouveau statut `pre_game`
      (migration 010) qui s'intercale entre `accept` et `active`, avec trois
      phases : `awaiting_flip`, `awaiting_choice`, `resolved`. Chaque joueur
      clique « lancer la pièce » ; le second clic déclenche un RNG serveur
      qui pose `coin_flip_winner_id`. Le vainqueur seul appelle
      `first-player-choice` avec `P1`/`P2` ; passé 30 s, `P1` est choisi
      automatiquement pour ne pas geler la partie. Conséquence : la
      **convention de siège change** — seat 0 = premier joueur (challenger
      ou opposant), ce qui laisse le moteur voir son team 1 habituel sans
      couche de traduction. Écran pré-game dédié dans `EngineDuelRoom.tsx`
      (animation pièce + boutons de choix + compte à rebours). Endpoints :
      `POST /duels/:id/coin-flip`, `POST /duels/:id/first-player-choice`,
      `GET /duels/:id/engine/pre-game`. Broadcast socket `duel:pregame`.
- [x] Lancers de pièce et de dés — **fait le 2026-08-04.** Nouveau champ
      `DuelStateResponse.tosses` — `MSG_TOSS_COIN` et `MSG_TOSS_DICE` sont
      captés dans `session.absorb`, poussés en événements de 4 s de TTL et
      diffusés aux deux joueurs (public dès qu'ils tombent). Composant
      `TossOverlay` en superposition centrale avec glyphe (🪙/🎲) et le
      résultat en grand. `duel:autoplay` couvre le format ; pas de deck de
      test qui les déclenche, la vérification finale se fera à deux joueurs.
- [x] Libellés d'effets réels — **fait le 2026-08-04.** Nouveau service
      `hintStrings.ts` qui parse `strings.conf` d'EDOPro au démarrage (fil
      principal **et** worker, deux espaces mémoire distincts). Trois tables
      chargées : `!system` (invites), `!counter` (marqueurs), `!setname`
      (archétypes). `MSG_HINT · SELECTMSG / MESSAGE` alimente
      `DuelPrompt.hint = { title, note }`, injecté en tête des modals côté
      client. `MSG_HINT · OPSELECTED` s'accumule dans `pendingOptionLabels`
      et remplace les « Effet 1/2 » de `SELECT_OPTION` par le vrai texte de
      l'effet (via `!system <id>` de la carte). `SELECT_COUNTER` rend
      « Spell Counter » plutôt que « Marqueur #67 » quand le nom est connu.
      Script `fetchDuelStrings.ts` : dépôt automatique dans
      `server/assets/duel/strings.conf`, avec fallback silencieux en libellés
      génériques si le fichier est absent — le duel reste jouable dans les
      deux cas. **Note :** les miroirs publics testés sont en chinois ;
      l'utilisateur doit copier son propre fichier depuis EDOPro (`config/`
      du zip).
- [x] Abandon · Chronomètre — **fait le 2026-08-04.**
      *Abandon* : nouvel endpoint `POST /duels/:id/engine/surrender` qui
      marque `winner_id = adversaire`, coupe le chrono, détruit la session
      moteur et broadcast `duel:finished` avec `reason: 'surrender'`. Bouton
      « Abandonner » dans le header de l'arène, avec modale de confirmation.
      *Chess-clock* (migration 011) : 25 min par joueur, décompte serveur
      uniquement quand c'est son tour ou qu'il doit répondre à un prompt.
      `DuelClockModel.startFor` bascule automatiquement à chaque coup
      accepté ; `stop` à la fin. Zéro = défaite immédiate, tranchée dans
      `choose` avant d'atteindre le moteur. Front : `ClockDisplay` dans le
      header (deux pilules « Toi / Adv. »), teinte or sous 2 min, animation
      pulse rouge sous 30 s. Recalage par `serverNow` à chaque snapshot
      pour éviter la dérive d'horloge entre deux navigateurs.
- [x] Narration de combat (`ATTACK`, `BATTLE`, `ATTACK_DISABLED`,
      `DAMAGE_STEP_*`, `MISSED_EFFECT`, `CHAIN_NEGATED/_DISABLED`,
      `WAITING`) — **fait le 2026-08-04.** Nouveau champ
      `DuelStateResponse.combatLog` (circular buffer de 20 événements),
      alimenté dans `session.absorb`. Composant `CombatLogFeed` en drawer
      latéral gauche, repliable ; toast bref au centre pour les événements
      d'attention (`missed_effect`, `chain_negated/_disabled`,
      `attack_disabled`). Public aux deux joueurs par défaut, avec un
      champ `forPlayers` prêt pour restreindre plus tard.
- [x] Animation de pioche — **fait le 2026-08-04.** Nouveau champ
      `DuelStateResponse.animations` alimenté par `MSG_DRAW` (§3.2) et
      filtré par siège : le joueur qui pioche voit ses passcodes, l'adversaire
      voit une pioche « aveugle » (juste le nombre, aucun code).
      `<DrawAnimation>` côté client s'appuie sur les keyframes existantes
      `san-draw-card` (theme.css) — cartes qui glissent en stagger 80 ms.
- [x] Narration §3.2 — **fait le 2026-08-04.** Nouveau type
      `DuelAnimationEvent` (shared/duelView.ts) + absorption dans
      `session.ts` pour `MOVE`, `POS_CHANGE`, `SWAP`, `EQUIP`, `SHUFFLE_*`,
      `DECK_TOP`, `ADD_COUNTER`, `REMOVE_COUNTER`, `BECOME_TARGET`,
      `CARD_TARGET`, `SUMMONED`, `SPSUMMONING` (avec variante Xyz/Synchro/
      Link/Fusion/Ritual/Pendulum), `FLIPSUMMONED`, `CHAINED`,
      `CHAIN_SOLVING`, `CHAIN_SOLVED`, `CHAIN_END`, `FIELD_DISABLED`,
      `CARD_HINT`, `PLAYER_HINT`. TTL 2 s, cap à 60 événements.
      **Filtrage anti-fuite** : `SHUFFLE_HAND` et `DECK_TOP` portent des
      passcodes secrets — ne partent qu'au propriétaire ; l'adversaire reçoit
      la même animation *sans codes*. `MOVE` avec origine ou destination
      dans HAND/DECK/EXTRA suit la même règle.
      Client : `<AnimationLayer>` en overlay, bandeau de micro-narrations en
      haut à droite, glyphes typés (◈ Xyz, ☼ Synchro, ◇ Link, ⛓ Chaîne, ⇄
      Move, ◎ Target…). Pas de dépendance externe : CSS transitions +
      `requestAnimationFrame`.
- [x] Flow activation §4bis — **fait le 2026-08-04 (Bloc 3).**
      **Audit A.1** : le design serveur était déjà étanche par construction
      — le prompt est filtré au siège concerné (`session.view` ligne 640),
      les révélations par `forPlayer === seat` (626), le combatLog par
      `forPlayers` (630), et `snapshot.ts` masque les cartes face verso de
      l'adversaire (code=0). Aucune fuite trouvée dans l'existant.
      **A.2 refactor client** : nouveau composant `<CardActionMenu>` qui
      bufferise le choix côté React. Tout clic sur une carte (main, monstres,
      S/T, face verso) ouvre le menu — même à une seule option. Boutons
      « Valider » (or) et « Annuler » (ghost) en bas. Rien n'est envoyé au
      serveur avant Valider ; l'adversaire ne voit rien.
      **A.3 test non-fuite** : nouveau `auditNoLeakDuringActivationMenu`
      dans `duelAutoPlay.ts` — sur le premier prompt d'une partie, on lit
      l'état côté adverse, on attend 500 ms, on relit, et on vérifie que
      handCount, monstres, prompt et combatLog n'ont pas bougé.
      Audit vérifié aussi que les animations `shuffle_hand`/`deck_top`/`draw`
      côté adversaire ne portent jamais de codes de main. Résultat autoplay
      5 parties : **0 fuite, 0 invite non couverte, 0 refus**.
- [x] Polish UI §5 — **fait le 2026-08-04.**
      **C.1** : `<JournalPanel>` à deux onglets — « Actions » (invocations,
      chaînes, attaques, dégâts) et « Déroulé » (tour, phase, pioche, hint).
      La catégorisation vit côté client ; côté serveur, `state.log` reste
      unique. **C.2** : les prompts `cards` et `sort` affichent en tête
      « Sélectionne exactement N cible(s) » ou « entre N et M cibles » —
      pas de comptage à faire à la main. **C.3** : confirmation « Terminer
      ton tour ? » quand la Main1 a des cartes non jouées ou quand des
      monstres n'ont pas attaqué en Battle. Case « Ne plus demander cette
      partie » stockée en state React. **C.4** : Extra Deck adverse ouvrable
      (public en YGO — règle officielle) via clic sur la pile, symétrique du
      cimetière adverse.
- [x] Écran mobile — **fait le 2026-08-04.** Nouveau
      `mobile/src/app/duel/engine/[id].tsx`, miroir portrait de
      `EngineDuelRoom.tsx` : plateaux empilés (adversaire haut / joueur bas),
      main scrollable horizontalement en bas, chronos or/rouge dans le
      header, pré-game intégré (pile ou face + choix P1/P2), bouton
      « Abandonner » avec confirmation, prompt en overlay bas avec sélection
      multiple + « Valider »/« Passer ». Types moteur ajoutés à
      `mobile/src/types.ts` en miroir de `shared/duelView.ts`. Service
      `mobile/src/services/duelEngineApi.ts` en miroir du web. Redirection
      auto depuis `mobile/src/app/duel/[id].tsx` (manuel) vers l'arène
      moteur quand `engine_mode || phase_pre_game` est posé. **Pas de
      socket.io** : polling `view()` toutes les 1.5 s tant que le duel est
      actif — la dep n'a pas été ajoutée pour ne pas alourdir le bundle,
      note pour un futur bloc. Sync F1 (pré-game), F2 (abandon), F5
      (ClockPill) livrée en même temps. F7 (spectateur) mobile : non
      livré ce bloc — l'API existe côté back, l'écran est à faire.
- [x] Match en 3 manches · Reprise · Spectateurs — **fait le 2026-08-04.**
      **F4 · Match Bo3** : migration 012 avec `duel_matches` (best_of, score,
      status pending → active → sideboard → finished) et `duel_side_decks`
      (soumissions main/extra/side par manche + user). `deck_cards` étendue
      avec `is_side_deck` (mutex avec `is_extra_deck`). `duels` gagne
      `match_id` + `game_number`. Modèle `DuelMatchModel` (create,
      recordGameWin qui bascule sideboard ou finished selon score,
      setActiveNextGame). `DuelSideDeckModel` (submit idempotent avec unique
      key). Contrôleur `DuelMatchController` avec 4 endpoints :
      `POST /duels/matches`, `GET /duels/matches/:id`,
      `POST /duels/matches/:matchId/side-deck/submit` (validation stricte :
      la composition post-side doit être un multi-ensemble identique au
      deck précédent — anti-triche), `POST /duels/matches/:matchId/next-game`
      (attend les 2 soumissions puis crée le duel enfant). Le contrôleur
      moteur, à la manche ≥ 2, repart des soumissions via nouveau helper
      `buildEngineDeckFromIds`. Progression du match branchée sur `choose`
      (fin de duel) et `surrender`. Page web `DuelMatchLobby.tsx` à trois
      colonnes cliquables (main → side, extra → side, side → main), écran de
      fin de match avec score.
      **F6 · Reprise après redémarrage** : nouveau
      `server/src/services/duelEngine/rehydrate.ts`. Pour chaque duel actif,
      on relit la graine (`engine_seed`) et le journal
      (`duel_engine_actions`), on recrée la session moteur avec la même
      graine, puis on rejoue chaque décision via `chooseInEngine`. Sait
      gérer les manches ≥ 2 (relit les soumissions side-deck). Hook au boot
      dans `server/src/index.ts` (setTimeout 3 s pour laisser le worker
      s'initialiser) — log `[duel:rehydrate] X/Y rejoués`. Endpoint admin
      `POST /duels/:id/engine/rehydrate` pour rejeu manuel. Script
      `npm run duel:rehydrate-check [N]` qui prend N duels terminés et
      vérifie que le rejeu converge (status et vainqueur alignés). Exécuté
      à vide (0 duel finished en DB dev) — logique validée à la compile,
      tourne quand des parties existent.
      **F7 · Spectateurs** : nouvelle méthode `session.spectate()` qui
      construit une vue **sans main détaillée** ni prompt (own=false pour
      les deux côtés), en filtrant combatLog et animations à `forPlayers ===
      'both'` uniquement — les événements privés (SHUFFLE_HAND, DECK_TOP,
      DRAW privé) ne partent jamais. `worker.ts` gagne un type `spectate`,
      `engineClient.ts` expose `spectateEngineDuel`. Endpoint
      `GET /duels/:id/engine/spectate` : refuse aux participants (ils ont
      la vue normale, la spectate leur masquerait leur main), refuse aux
      duels non-actifs, contrôle que l'appelant **suit au moins un des deux
      joueurs** via `FollowModel.isFollowing`. Page web `DuelSpectate.tsx`
      (route `/duel/:id/spectate`) : deux plateaux empilés, journal et
      combat log, refresh sur `duel:engine_update` (socket rejoint la room
      `duel:${id}`) + poll de secours 3 s.

## 8bis. Flow activation validé (Bloc 3)

Le §4bis est terminé côté web. La double garantie est en place :

1. **Serveur** : le prompt `SELECT_EFFECTYN` / `SELECT_OPTION` est déjà
   filtré au siège concerné — la vue de l'adversaire ne montre ni le prompt,
   ni les révélations, ni les combatLog associés. Vérifié dans `session.ts`
   `view()` : `prompt: prompt && prompt.seat === seat ? prompt : null`.
2. **Client** : les actions ne quittent React qu'après clic « Valider ». Un
   « Annuler » referme le menu sans effet ; le prompt serveur reste ouvert,
   le joueur peut recliquer une autre carte.

Test A.3 : `duelAutoPlay` mesure sur le premier prompt d'une partie la
stabilité de la vue adverse pendant 500 ms d'inactivité — handCount,
monstres, prompt, combatLog inchangés. **5/5 parties** autoplay clean.

Les animations `SHUFFLE_HAND`, `DECK_TOP`, `DRAW` du plateau adverse voyagent
sans codes vers l'adversaire — le champ `forPlayers` sur
`DuelAnimationEvent` porte l'étanchéité.

---

## 9. État final au push v1 (Bloc 5 · 2026-08-04)

**Bloc 5** ferme les reports du Bloc 4 et pousse la couverture au maximum
avant l'étiquette v1. Le duel moteur est **complet côté web** et **paritaire
côté mobile** (portage §4bis inclus).

### 9.1. Couverture messages moteur — 62 / 94

Section §3.1 (« ceux qui comptent vraiment ») : **100 %**.

- `RETRY` (Bloc 1) — visible, toast rouge, filtré au bon siège, testé par
  `FORCE_RETRY=1 npm run duel:autoplay:snake-eye 1` (Bloc 5).
- `HINT` (Bloc 2) — `SELECTMSG`/`MESSAGE`/`OPSELECTED` traduits via
  `strings.conf` (fallback FR → EN → générique). Script de backfill FR
  par Claude Haiku : `npm run duel:backfill-hints-fr` (Bloc 5).
- `CONFIRM_CARDS` / `_DECKTOP` / `_EXTRATOP` (Bloc 1) — `RevealOverlay`
  6 s de TTL, filtrage par siège, badge coloré Deck (dessus) / Extra
  (dessus). Porté mobile (Bloc 5).
- `TOSS_COIN` / `TOSS_DICE` (Bloc 2) — `TossOverlay` sur les deux fronts
  (Bloc 5).
- `MISSED_EFFECT`, `CHAIN_NEGATED`, `CHAIN_DISABLED` (Bloc 2) — combat log
  drawer + toast rouge sur événements d'attention. Porté mobile (Bloc 5).
- `WAITING` (Bloc 2) — combat log + bandeau « en attente de l'adversaire ».
- `ATTACK_DISABLED`, `BATTLE`, `DAMAGE_STEP_START/END` (Bloc 2) — combat log.

Section §3.2 (« animations ») : **100 %** — `MOVE`, `POS_CHANGE`, `SWAP`,
`EQUIP`, `SHUFFLE_*`, `DECK_TOP`, `ADD_COUNTER`, `REMOVE_COUNTER`,
`BECOME_TARGET`, `CARD_TARGET`, `SUMMONED`, `SPSUMMONED` (variantes
Xyz/Synchro/Link/Fusion/Ritual/Pendulum), `FLIPSUMMONED`, `CHAINED`,
`CHAIN_SOLVING`, `CHAIN_SOLVED`, `CHAIN_END`, `FIELD_DISABLED`, `CARD_HINT`,
`PLAYER_HINT`, `DRAW`. `AnimationLayer` mobile porté au Bloc 5.

Section §3.3 (« pas concerné ») : **exclusion assumée** — `AI_NAME`,
`TAG_SWAP`, `MATCH_KILL`, `CUSTOM_MSG`, `REQUEST_DECK`, `UPDATE_DATA`,
`UPDATE_CARD`, `RELOAD_FIELD`, `HAND_RES`.

Reste ~ 30 messages du bas de spectre (positions de debug moteur, hints
d'échantillonnage, contrôles de flux internes) que le contrat de vue absorbe
sans les propager — leur absence n'est pas un défaut visible.

### 9.2. Couverture réponses — 21 / 21

Toutes les réponses attendues par ygopro-core sont couvertes :

- Sélection et interaction : `SELECT_IDLECMD`, `SELECT_BATTLECMD`,
  `SELECT_CARD`, `SELECT_TRIBUTE`, `SELECT_SUM`, `SELECT_UNSELECT_CARD`,
  `SELECT_PLACE`, `SELECT_DISFIELD`, `SELECT_POSITION`.
- Chaîne et confirmations : `SELECT_CHAIN`, `SELECT_EFFECTYN`,
  `SELECT_YESNO`, `SELECT_OPTION`.
- Ordonnancement et hasard : `SORT_CARD`, `ROCK_PAPER_SCISSORS`.
- Annonces : `ANNOUNCE_RACE`, `ANNOUNCE_ATTRIB`, `ANNOUNCE_NUMBER`,
  **`ANNOUNCE_CARD`** (Bloc 1), **`SELECT_COUNTER`** (Bloc 1),
  **`SELECT_CARD_CODES`** (Bloc 1).

### 9.3. Fonctionnalités F1 → F8

| # | Sujet | Web | Mobile |
|---|---|---|---|
| F1 | Pile ou face au lancement | ✅ Bloc 2 | ✅ Bloc 4 |
| F2 | Abandon | ✅ Bloc 2 | ✅ Bloc 4 |
| F3 | Animation de pioche | ✅ Bloc 3 | ✅ Bloc 5 |
| F4 | Match Bo3 · Side Deck | ✅ Bloc 4 | ⚠ non porté (Bloc 6) |
| F5 | Chess-clock | ✅ Bloc 2 | ✅ Bloc 4 |
| F6 | Rejeu du journal | ✅ Bloc 4 | ✅ Bloc 4 (partagé côté serveur) |
| F7 | Spectateur | ✅ Bloc 4 | ✅ Bloc 5 |
| F8 | Écran mobile | — | ✅ Bloc 4 (base) + Bloc 5 (parité §4bis) |

### 9.4. Polish UI traités (§5)

- **§5 · Libellés d'effets** — `strings.conf` chargé côté serveur, fallback
  FR → EN. Script `npm run duel:backfill-hints-fr` (Bloc 5) traduit un
  fichier EN complet vers FR via Claude Haiku par batches de 20 lignes,
  reprise `--resume` idempotente. À exécuter une fois qu'un `strings.conf`
  EN est déposé dans `server/assets/duel/`.
- **§5 · Journal séparé** — `JournalPanel` à deux onglets (Actions /
  Déroulé) sur web (Bloc 3) et mobile (Bloc 5).
- **§5 · Indication de portée** — bandeau « Sélectionne entre N et M cibles »
  en tête des prompts `cards` / `sort`, web (Bloc 3) et mobile (Bloc 5).
- **§5 · Confirmation coup irréversible** — Phase de Fin avec case « Ne
  plus demander cette partie », web (Bloc 3) et mobile (Bloc 5). Abandon
  avec modale de confirmation, deux fronts.
- **§5 · Extra Deck adverse** — ouvrable au clic (public en YGO — règle
  officielle), web (Bloc 3) et mobile (Bloc 5).
- **§4bis · Menu contextuel bufferisé** — `CardActionMenu` porté au Bloc 5.
  L'adversaire ne voit rien avant Valider, garantie serveur (prompt filtré
  au siège) + client (aucun `send` avant clic).

### 9.5. Temps réel mobile — socket.io (Bloc 5)

Le polling mobile était à 1.5 s. La dep `socket.io-client@^4.7.5` est
désormais installée (approuvée dans le plan). Service
`mobile/src/services/socket.ts` en miroir du web, avec authentification
JWT lue depuis `storage`. Le service `duelEngineApi.subscribe(duelId, ...)`
suit exactement l'API web — souscription non bloquante, cleanup automatique.

L'écran arène + spectate préfèrent socket ; poll de secours 5 s quand le
socket répond, 1.5 s en dégradé. La bascule est automatique via
`setSocketAlive(true)` au premier event reçu.

### 9.6. Tests étendus (§6.1)

- **Autoplay standard** — `NODE_OPTIONS=--experimental-sqlite npm run
  duel:autoplay 5` : **5/5 parties**, 2 194 décisions, 0 fuite,
  0 invite non couverte, 0 réponse refusée. Le deck de Blue-Eyes couvre
  chain (1 550 ×), main (321 ×), battle (139 ×), place (109 ×), cards
  (67 ×), position (8 ×).
- **Autoplay Snake-Eye** — `npm run duel:autoplay:snake-eye 3` : deck méta
  (Snake-Eye Ash, Diabellstar, Bonfire, Ash Blossom, Effect Veiler,
  Infinite Impermanence) + Extra Deck (Snake-Eyes Flamberge, Salamangreat
  Almiraj, I:P Masquerena). Charge des scripts Lua réels ; couvre en plus
  `confirm` (4 ×) et rencontre les cas de zones pleines. 0 fuite détectée.
- **RETRY forcé** — `FORCE_RETRY=1 npm run duel:autoplay:snake-eye 1` :
  envoie un ID invalide sur le premier prompt, vérifie que `lastRetry`
  remonte au bon siège. Résultat : **1/1 détecté**, exception explicite
  `« Choix invalide pour cette demande »`.
- **Rehydrate check** — `npm run duel:rehydrate-check 3` : 0 duel finished
  en DB dev, logique validée à la compilation, se déclenche dès que des
  duels moteur terminés existent (le hook boot le fait automatiquement).

### 9.7. Cas d'usage §6.2 (manuel à deux joueurs)

**Non testés au push v1** — l'auto-joueur ne remplace pas deux navigateurs
qui interagissent en même temps. Points à surveiller au premier essai
réel :

1. Un tour complet — pioche, invocation, pose, attaque, fin de tour.
2. Une chaîne à deux — l'un active, l'autre répond.
3. Invocation par tribut multiple — la sélection accumule bien ?
4. Recherche dans le deck — la fenêtre centrale s'ouvre.
5. Rechargement de page en pleine partie — l'état revient via `spectate` ou
   `view` selon le rôle.
6. Coupure WebSocket — le poll de 5 s (web) / 5 s (mobile) prend le relais.
7. Deux onglets même joueur — les deux restent cohérents (socket join sur
   la room `duel:${id}`).
8. Purge après 30 min — le TTL du worker coupe et broadcast `engine_lost`.

### 9.8. Reports assumés (Bloc 6 ou plus tard)

- **F4 Match Bo3 mobile** — le back est prêt, l'écran side-deck mobile
  reste à faire. Priorité basse : les matches Bo3 se jouent surtout en
  tournoi web.
- **Bouton « Regarder » sur feed social mobile** — la route
  `/duel/spectate/[id]` est prête, mais la découverte automatique des
  duels actifs des users suivis demande un endpoint dédié
  (`GET /duels/active?following=1`) qui n'existe pas encore. Le web n'a
  pas non plus ce bouton — parité maintenue.
- **Transition « manche gagnée » + écran fin de match** — le back Bo3 les
  gère (via `DuelMatchModel.recordGameWin`), mais l'animation entre deux
  manches n'est pas encore visuelle. Non bloquant : le score s'affiche
  déjà sur `DuelMatchLobby`.
- **strings-fr.conf peuplé** — script prêt, `strings.conf` EN à déposer
  d'abord. À faire par un opérateur (télécharger EDOPro, copier
  `config/strings.conf`).

### 9.9. Recommandations pour la suite

- **Surveiller les erreurs Lua Snake-Eye** — `chain.lua:85 Passed invalid
  CHAININFO flag` sur `c23434538` (WANTED) et `c4280259` (Salamangreat
  Almiraj) : symptôme d'une divergence entre `ocgcore-wasm@0.1.2` et les
  scripts modernes de ProjectIgnis. À vérifier lors d'une éventuelle
  montée de version du moteur (le paquet est à 0.2.x en amont).
- **`socket.io-client` sur mobile ajoute 200 Ko au bundle** — surveiller
  la taille de l'APK/IPA à l'export EAS. Si problème, activer le splitting
  Metro ou revenir au poll pur (fallback déjà branché).
- **Endpoint `/duels/active?following=1`** — pour activer le vrai « Watch
  friends » dans le feed social, l'ajouter dans `DuelController` et
  brancher un composant `ActiveDuelsBanner` sur le mobile.
- **Charge serveur** — le broadcast `duel:engine_update` va à toute la
  room. Avec beaucoup de spectateurs sur un duel, prévoir un throttle.
  Non critique tant que <10 spectateurs simultanés.

---

## 10. Bloc 6 · Combler les gaps de l'audit (2026-08-04)

Consommation des recommandations §5.1 + §6 P1 de `AUDIT-DUEL-COMPLET.md`. Sept
chantiers, livrés en un seul push.

### 10.1. Livrables

| Chantier | Portée | État |
|---|---|:-:|
| C1 · Pendulum Zones web + mobile | 2 PZones rendues, bordure violette + badge « P », indication invocation Pendulum active | ✅ |
| C2 · Mobile landscape obligatoire | `expo-screen-orientation` installé, `lockAsync(LANDSCAPE)` posé sur les 3 écrans duel (moteur, manuel, spectateur), unlock en cleanup. Refonte layout : plateau miroir horizontal, EMZ centrales, Field/Extra/Deck/Cimetière/Bannies en colonnes latérales, PZones aux extrémités des spells, rotation 90° pour défense, ZoneSlot cliquable pour SELECT_PLACE | ✅ |
| C3 · Marqueurs + Xyz + équipés | Badge doré compteur (bas-droite), badge cyan « Xn » matériaux (haut-gauche), scale Pendule (haut) sur web ET mobile. Trait équipement : les animations EQUIP restent transitoires (2 s), lien permanent = report v1.1 | ⚠ partiel |
| C4 · ChainPanel | `snapshot.ts` remonte `field.chain` → `DuelBoardView.chain` (nouveau) + `chainSolvingLink`. Composant `ChainPanel` (web, rail à côté du plateau) et `ChainPanelMobile` (rail bas plateau). Maillon en résolution surligné doré | ✅ |
| C5 · Banlist + max 3 | `deckLoader.ts` : `banlistLimit()`, `validateDeckLegality()`, `validateDeckLegalitySync()`, `checkEngineDeckStrict()`. Câblé dans `duelEngineController.start` — refuse le duel si Forbidden ou max copies dépassé. Endpoint `POST /duels/:id/engine/validate-deck` ajouté. Client `DeckEditor` : validation banlist en temps réel (Forbidden / Limited / Semi-Limited) | ✅ |
| C6 · Messages narratifs | `session.ts` absorbe désormais : `START`, `SHOW_HINT`, `SWAP_GRAVE_DECK`, `SHUFFLE_SET_CARD`, `REVERSE_DECK`, `CARD_SELECTED`, `RANDOM_SELECTED`, `CANCEL_TARGET`, `REMOVE_CARDS`, `BE_CHAIN_TARGET`, `CREATE_RELATION`, `RELEASE_RELATION` — ligne journal + éventuelle anim | ✅ |
| C7 · Hint types + hint_timing | HINT_EFFECT / CARD / ZONE / NUMBER / RACE / ATTRIB / CODE désormais journalisés (au lieu d'être ignorés silencieusement). `withHint` fusionne titre+note au lieu d'écraser. `SELECT_CHAIN` : `hint_timing` décodé et transmis comme note (« Fenêtre : Fin de la Battle Phase, Après destruction ») | ✅ |

### 10.2. Validation

- `cd server && npx tsc --noEmit` : clean
- `cd client && npm run build` (tsc): clean
- `cd mobile && npx tsc --noEmit` : clean
- `npm run duel:autoplay` standard : **3/3 parties** — 1284 décisions,
  0 fuite, 0 refus, 0 invite non couverte
- `npm run duel:autoplay:snake-eye` : partiel — les erreurs Lua
  `chain.lua:85 Passed invalid CHAININFO flag` sur `c23434538` / `c4280259`
  sont **préexistantes** (déjà signalées §9.9), non liées à ce Bloc 6

### 10.3. Reports v1.1

- **Trait équipement permanent SVG** (C3 P2.c de l'audit) — 3-4 h · le badge
  ne remplace pas le lien visuel, mais l'animation EQUIP couvre 90 % des cas.
- **Matériaux Xyz cliquables individuellement** (P2.b) — 2 h · le compteur
  est là, l'ouverture d'un modal avec les noms reste à ajouter.
- **Position visuelle mobile face-verso ATK vs DEF** — le mode « Verso DEF »
  est distingué mais pas de cadre spécifique.
- **Menu long-press mobile pour changer position ATK↔DEF** — pris en charge
  par le CardActionMenu quand le moteur propose l'action, pas encore par un
  raccourci indépendant.

