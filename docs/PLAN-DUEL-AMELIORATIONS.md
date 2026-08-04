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

- [ ] `RETRY` visible
- [ ] `SELECT_COUNTER`
- [ ] `ANNOUNCE_CARD` avec recherche et filtre d'opcodes
- [ ] `SELECT_CARD_CODES`
- [ ] Cartes révélées (`CONFIRM_*`)
- [ ] Pile ou face
- [ ] Lancers de pièce et de dés
- [ ] Libellés d'effets réels
- [ ] Abandon · Chronomètre
- [ ] Animation de pioche
- [ ] Écran mobile
- [ ] Match en 3 manches · Reprise · Spectateurs
