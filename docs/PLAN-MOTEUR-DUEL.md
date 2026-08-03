# Plan d'action — intégration du moteur de duel ygopro-core

> Fichier de passation, mis à jour et poussé **à chaque étape**, comme `SUIVI-REFONTE.md`.
>
> **Branche :** `dev`
> **Dernière mise à jour :** 2026-08-03 — plan établi, étape 0 en attente d'arbitrage

---

## 1. Point de départ

Le lot [`d5fa26f`](https://github.com/Kevin-Lettron/yugioh-collection-manager/commit/d5fa26f)
a livré un duel PvP **manuel** (« option 3 ») : points de vie, phases, attaques, chat,
temps réel. 7 333 lignes, `tsc` propre. Ce qu'il ne fait pas — et ne fera jamais sans
moteur — c'est **appliquer les effets des cartes**. Les deux joueurs se mettent d'accord
à la main, comme sur un tapis de jeu physique.

La note de fin du commit disait :

> *« un vrai duel avec effets de cartes (Master Duel-like) sera implementé via
> integration ygopro-core »*

C'est là qu'on s'était arrêtés : à l'intention. Aucune ligne, aucune dépendance.

**Ce plan ne remplace pas le duel manuel.** Il ajoute un second mode. Le manuel reste le
filet de sécurité tant que le moteur n'est pas fiable, et de toute façon utile pour les
cartes non scriptées ou les formats maison.

---

## 2. Le terrain

`ygopro-core` est le moteur de règles de YGOPro / EDOPro. C'est du **C++**, il expose une
API C (`OCG_CreateDuel`, `OCG_StartDuel`, `OCG_DuelProcess`, `OCG_DuelGetMessage`,
`OCG_DuelSetResponse`…) et il ne sait rien des cartes par lui-même : l'hôte lui fournit
deux lecteurs, un pour les **données de carte** et un pour les **scripts Lua**.

Autrement dit, il faut trois briques, pas une :

| Brique | Source | Poids | État |
|---|---|---|---|
| Le moteur | [`edo9300/ygopro-core`](https://github.com/edo9300/ygopro-core) | — | actif (poussé le 2026-07-31) |
| Les scripts de cartes (Lua) | [`ProjectIgnis/CardScripts`](https://github.com/ProjectIgnis/CardScripts) | ~72 Mo | actif (2026-08-02) |
| Les données de cartes (`cards.cdb`, SQLite) | [`ProjectIgnis/BabelCDB`](https://github.com/ProjectIgnis/BabelCDB) | ~245 Mo | actif (2026-07-31) |

### Par où on l'attaque

Trois voies possibles, une seule tient debout :

1. **Compiler le C++ et l'appeler en FFI depuis Node.** Toolchain C++ à maintenir sur le
   VPS, recompilation à chaque montée de version, segfaults qui tuent le process Node.
   Coûteux et fragile.
2. **Le binding npm existant, [`ygocore`](https://www.npmjs.com/package/ygocore).**
   Écarté : dernière publication en **2019**, encore marqué `[WIP]`, basé sur `nan`
   (l'ancienne API d'addons, cassée sur Node moderne) et sur le core Fluorohydride
   abandonné. Mort.
3. **[`ocgcore-wasm`](https://github.com/n1xx1/ocgcore-wasm)** — le core EDOPro compilé en
   WebAssembly par emscripten, avec une couche TypeScript par-dessus. `npm i ocgcore-wasm`,
   4,6 Mo, aucune dépendance runtime, wrapper MIT. **C'est la voie retenue.**

Ce qui fait pencher la balance : le paquet expose déjà les messages du moteur **décodés en
objets typés** (`src/type_message.ts`, `src/messages.ts`, ~42 Ko de définitions). Sans ça,
il aurait fallu écrire le décodeur du protocole binaire `MSG_*` à la main — c'est le poste
de travail le plus lourd de toute l'intégration, et il est déjà fait.

### Ce qu'il faut savoir avant de s'engager

- **Version 0.1.2, 7 étoiles, un seul mainteneur.** Le paquet est vivant (35 versions,
  dernière poussée en mai 2026) mais jeune. On ne s'appuie pas sur un standard de
  l'industrie. Prévoir de figer la version et de lire les diffs avant chaque montée.
- **Pas de sérialisation d'un duel en cours.** L'API publique n'expose ni snapshot ni
  restauration (`type_serialize.ts` ne concerne que les énumérations des messages, pas
  l'état de partie). Un duel vit dans le tas WASM : **un redémarrage du serveur tue les
  duels en cours.** Conséquence de conception, actée à l'étape 4.
- **`duelProcess` est du calcul synchrone.** Exécuté dans la boucle Node, il gèle l'API le
  temps de résoudre une chaîne. D'où les `worker_threads` à l'étape 2.
- **Le moteur ne coûte rien par partie.** Contrairement au scan (Claude Vision), tout
  tourne en local. Aucun appel réseau facturé par duel.

---

## 3. Deux arbitrages à rendre avant la première ligne

### 3.1 La licence — bloquant

`ygopro-core` est sous **AGPL-3.0**. L'article 13 de l'AGPL est le point qui compte : si un
utilisateur interagit avec le logiciel **à travers un réseau**, il doit se voir offrir le
code source correspondant. Un duel joué depuis le navigateur, c'est exactement ce cas.

Deux options :

| | A — publier Keitland sous AGPL | B — isoler le moteur |
|---|---|---|
| Principe | Le dépôt entier passe sous AGPL-3.0 | Le moteur devient un service séparé (son propre process, sa propre licence AGPL), Keitland lui parle en HTTP |
| Effort | Ajouter un `LICENSE` | +1 à 2 j de travail, un service de plus à déployer |
| Conséquence | Le code est déjà public sur GitHub — le changement est essentiellement formel | Keitland garde la licence qu'on veut |
| Recommandation | **A**, sauf intention commerciale à court terme | |

Le dépôt **n'a aujourd'hui aucun fichier `LICENSE`** — sans licence explicite, personne
n'a le droit de réutiliser le code, y compris toi si tu changes d'avis plus tard. Quel que
soit le choix, il faut en poser un.

### 3.2 Les données de cartes — à vérifier

`CardScripts` et `BabelCDB` **ne déclarent aucune licence** sur GitHub. Par défaut, cela
signifie « tous droits réservés », même si l'usage communautaire est massif et toléré
depuis plus de dix ans. À cela s'ajoute le fait que les textes et noms de cartes sont la
propriété de Konami.

Ce n'est pas un avis juridique et je n'en donnerai pas. Le risque est **faible en
pratique, non nul en droit**, et il porte sur la redistribution — pas sur l'usage. Une
atténuation simple : ne pas versionner ces fichiers dans le dépôt, les télécharger à
l'installation depuis leur source d'origine (c'est ce que fait le script de l'étape 1).

---

## 4. Architecture cible

```
client (web)  ·  mobile
      │   REST + WebSocket  (déjà en place depuis d5fa26f)
      ▼
server/src/services/duelEngine/
  ├─ assets.ts      téléchargement + vérification de cards.cdb et des scripts
  ├─ cardStore.ts   cards.cdb (SQLite) → Map<code, OcgCardData>, chargée au boot
  ├─ scriptStore.ts lecture des .lua, cache mémoire
  ├─ session.ts     un duel = un handle + sa file de messages + l'attente de réponse
  ├─ translate.ts   messages OCG → événements front ; réponses front → OCG
  ├─ registry.ts    Map<duelId, session>, TTL, quotas, nettoyage
  └─ worker.ts      worker_thread : le moteur ne tourne jamais dans la boucle principale
```

Le front existant (`DuelRoom.tsx`, `mobile/src/app/duel/[id].tsx`) est conservé. Ce qui
change, c'est la source de vérité : aujourd'hui l'utilisateur décide de ce qui se passe,
demain le moteur le lui **demande** (« choisis une cible », « veux-tu activer ? ») et
l'utilisateur répond.

---

## 5. Étapes

Les durées sont en **heures de travail effectif à deux** (toi + moi), pas en jours
calendaires. Sur un rythme de soirées à 2-3 h, divise par 2,5 pour avoir les séances.

Les estimations en heures sont des **fourchettes honnêtes, pas des engagements** : l'étape
3 en particulier dépend de ce qu'on découvre en la faisant.

| # | Étape | Heures | Coût € | Livrable qui prouve que c'est fait |
|---|---|---|---|---|
| 0 | Arbitrage licence + fichier `LICENSE` | 1 | 0 | Un `LICENSE` à la racine |
| 1 | Socle local : dépendance, assets, cardStore, premier duel | 4 – 6 | 0 | Un test qui joue le tour 1 d'un duel et logge les messages |
| 2 | Pont moteur ↔ serveur, worker_thread, registre | 8 – 10 | 0 | `POST /duels/:id/engine/start` renvoie les premiers messages |
| 3 | **Traduction des messages et des réponses** | 14 – 20 | 0 | Une partie complète jouée par un client de test scripté |
| 4 | Cycle de vie : TTL, quotas, journal rejouable, redémarrage | 4 – 6 | 0 | Un duel survit à 30 min d'inactivité, meurt proprement au reboot |
| 5 | Front web : prompts du moteur dans `DuelRoom` | 12 – 16 | 0 | Duel complet à deux navigateurs |
| 6 | Front mobile + `socket.io-client` (remplace le polling 2 s) | 8 – 12 | 0 | Duel complet téléphone contre navigateur |
| 7 | Légalité de deck + banlist (`lflist.conf` EDOPro) | 4 | 0 | Un deck illégal est refusé avec la raison |
| 8 | Déploiement : assets sur le VPS, RAM, supervision | 4 – 6 | voir §6 | Un duel joué en production |
| | **Total** | **59 – 81 h** | | |

### Détail des étapes qui méritent qu'on s'y arrête

**Étape 1 — le socle.** `npm i ocgcore-wasm` dans `server/`, puis un script
`server/scripts/fetchDuelAssets.ts` qui récupère `cards.cdb` et les scripts Lua en clone
superficiel dans `server/assets/duel/` (ignoré par git). `cardStore.ts` lit la table
`datas` de `cards.cdb` et la projette en `OcgCardData`. Point de vigilance identifié :
notre colonne `cards.card_id` contient l'**id YGOProDeck**, qui est le passcode Konami —
donc le code attendu par le moteur. Mais YGOProDeck attribue des ids distincts aux
illustrations alternatives (89631142 pour un autre artwork du Dragon Blanc, 89631140 pour
l'original) là où le moteur les résout par le champ `alias`. À traiter dans le mapping,
sinon des cartes légitimes seront introuvables.

**Étape 3 — le gros morceau.** Le moteur émet une centaine de types de messages. On ne les
couvre pas tous d'un coup : on vise d'abord le noyau jouable — pioche, mélange,
déplacement, invocation normale / posée / spéciale, attaque, dégâts, chaîne, phase,
victoire — plus les demandes de choix (`SELECT_CARD`, `SELECT_PLACE`, `SELECT_CHAIN`,
`SELECT_OPTION`, `SELECT_YESNO`, `SELECT_EFFECTYN`, `SELECT_POSITION`, `SELECT_BATTLECMD`,
`SELECT_IDLECMD`). Un message non traité ne doit **jamais** planter la partie : il est
journalisé et ignoré, et la liste des non-traités devient le carnet de bord de l'étape.

**Étape 4 — l'état volatile.** Puisqu'un duel ne se sérialise pas, on choisit la règle
plutôt que de la subir : le serveur persiste le **journal des actions** (pour le rejeu et
l'affichage), et un redémarrage annule les duels en cours — **sans défaite pour personne**.
C'est frustrant mais honnête ; l'alternative (rejouer le journal dans un moteur neuf) est
possible plus tard et se posera sur ces mêmes fondations.

**Étape 8 — la production.** Les assets pèsent ~1 Go une fois clonés (moins en superficiel).
La consommation mémoire par duel actif est à mesurer à l'étape 2 — c'est elle qui dira si
le droplet actuel tient.

---

## 6. Coût

### Récurrent

| Poste | Montant |
|---|---|
| Licences, paquets, API | **0 €** — tout est libre, et le moteur tourne en local : aucun appel facturé par duel |
| Stockage des assets (~1 Go) | inclus dans le disque du droplet |
| Éventuel passage à un droplet plus gros | **+10 à +25 €/mois** selon le palier |

Le seul poste incertain est le dernier, et il dépend d'une mesure qu'on n'a pas encore
faite (mémoire par duel actif, étape 2). Ordres de grandeur DigitalOcean pour les droplets
Basic, **à revérifier au moment de l'achat** : 1 Go ≈ 6 $/mois, 2 Go ≈ 12 $, 4 Go ≈ 24 $.

**Point de contrôle :** la taille actuelle du droplet n'est pas documentée ici. À relever
avant l'étape 8 (`free -h` et `nproc` en SSH).

### Non récurrent

Le vrai coût est le temps : **59 à 81 heures**. Selon le rythme :

| Rythme | Durée calendaire |
|---|---|
| Soirées, 2-3 h, 4 fois par semaine | **6 à 8 semaines** |
| Journées pleines | **8 à 11 jours** |

---

## 7. Avancement

- [ ] **Étape 0** — Arbitrage licence + `LICENSE` *(en attente de décision : option A ou B)*
- [ ] **Étape 1** — Socle local
- [ ] **Étape 2** — Pont moteur ↔ serveur
- [ ] **Étape 3** — Traduction des messages
- [ ] **Étape 4** — Cycle de vie
- [ ] **Étape 5** — Front web
- [ ] **Étape 6** — Front mobile
- [ ] **Étape 7** — Légalité de deck
- [ ] **Étape 8** — Déploiement

---

## 8. Quand arrêter

Un plan sans porte de sortie n'est pas un plan. On abandonne — ou on gèle — si :

- à l'étape 1, le moteur ne démarre pas un duel trivial en moins d'une journée ;
- à l'étape 3, la couverture des messages plafonne : les combos courants du méta restent
  injouables après 20 h de travail ;
- à l'étape 8, la mémoire par duel impose un droplet à plus de 40 €/mois.

Dans les trois cas, le duel manuel existe déjà et fonctionne. Ce n'est pas un échec, c'est
le mode dégradé qui devient le mode définitif.

---

## 9. Sources

- [edo9300/ygopro-core](https://github.com/edo9300/ygopro-core) — le moteur, AGPL-3.0
- [n1xx1/ocgcore-wasm](https://github.com/n1xx1/ocgcore-wasm) — le build WebAssembly retenu
- [ocgcore-wasm sur npm](https://www.npmjs.com/package/ocgcore-wasm) — v0.1.2
- [ProjectIgnis/CardScripts](https://github.com/ProjectIgnis/CardScripts) — les scripts Lua
- [ProjectIgnis/BabelCDB](https://github.com/ProjectIgnis/BabelCDB) — `cards.cdb`
- [ygocore sur npm](https://www.npmjs.com/package/ygocore) — l'ancien binding, écarté
