# Plan d'action — page Actualités Yu-Gi-Oh

> Fichier de passation, mis à jour et poussé **à chaque étape**, comme
> `SUIVI-REFONTE.md` et `PLAN-MOTEUR-DUEL.md`.
>
> **Branche :** `master`
> **Dernière mise à jour :** 2026-08-03 — plan établi, développement à démarrer.

---

## 1. Ce qu'on veut

Une page **Actualités** dans le sanctuaire, alimentée par des flux RSS de sites
d'information, restreinte à ce qui intéresse un joueur :

- le **TCG mondial** — annonces, changements de règles, banlist ;
- la **compétition** — tournois, résultats, decks du méta ;
- les **sorties de cartes**, avec les dates françaises.

L'utilisateur s'abonne aux thèmes qui l'intéressent, et son fil se réorganise en
conséquence : ce qu'il suit remonte, le reste passe en second plan.

Sur le web **et** sur l'app.

---

## 2. Ce qui existe vraiment comme sources

**Mesuré, pas supposé.** Chaque URL a été appelée avant d'écrire ce plan.

| Source | Flux | Résultat |
|---|---|---|
| **YGOrganization** | `https://ygorganization.com/feed/` | **200, 10 articles.** Chaque article porte ses catégories (`News`, `New Cards`, `OCG & TCG`, `Rush Duel`, `Reprints`, `Rulings`, `Speed Duel`…). La référence du milieu. |
| **Pojo** | `https://www.pojo.com/feed/` | **200, 10 articles.** Multi-JCC : Pokémon, Magic, Yu-Gi-Oh mêlés. Utilisable, mais **filtrage obligatoire**. |
| **Reddit r/yugioh** | `https://www.reddit.com/r/yugioh/.rss` | **200** au premier appel, **429** ensuite. Utilisable avec un `User-Agent` identifiable et une cadence lente. |
| **Konami officiel** | `yugioh-card.com` en `/feed/`, `/rss.xml`, versions `en`, `eu`, `fr` | **404 partout.** Le site officiel **n'a aucun flux**. |
| Yugipedia, Fandom | `Special:RecentChanges?feed=rss` | **403** — Cloudflare bloque. |
| Cardmarket | `/rss` | **403**. |

### Deux conséquences à assumer

**La source officielle n'est pas disponible.** Pas de flux Konami, ni en anglais
ni en français. La seule façon d'avoir leurs annonces serait de racler leur page
de news — fragile (ça casse à chaque refonte de leur site) et juridiquement plus
trouble que la syndication d'un flux, qui est faite pour ça. **On ne le fera
pas.** YGOrganization couvre de toute façon les annonces officielles dans
l'heure.

**Aucun flux en français n'a été trouvé.** Les articles seront en anglais. C'est
une limite réelle à annoncer clairement dans l'interface plutôt qu'à masquer.

### Les sorties de cartes ne viennent pas d'un flux

Pour les sorties, un flux RSS serait le mauvais outil : on veut des **dates**,
pas des articles. L'API YGOProDeck, déjà intégrée au projet, expose
`cardsets.php` — vérifié : **1 032 extensions, dont 1 030 avec une date de sortie
TCG**, et elle porte les sorties à venir :

```
2026-11-12 | MAMS | Magnificent Maestros      |  24 cartes
2026-09-04 | MAMO | Magnificent Monsters      |  18 cartes
2026-08-06 | LAVD | Legendary Arc-V Decks     | 115 cartes
```

C'est structuré, daté, fiable, et déjà dans nos dépendances. Le calendrier des
sorties sera donc bâti là-dessus, pas sur du RSS.

---

## 3. Ce qu'on stocke, et ce qu'on ne stocke pas

Un flux RSS est fait pour être syndiqué, mais pas pour être recopié. On garde le
**titre, le résumé fourni par le flux, le lien, la date, la source et
l'illustration** — et le clic renvoie **toujours** sur le site d'origine. On ne
stocke pas l'article complet et on n'en affiche jamais le corps.

C'est la règle de base d'un agrégateur qui ne veut pas se faire d'ennemis : on
envoie du trafic aux sites qu'on cite.

---

## 4. Architecture

```
              cron toutes les 30 min
                       │
server/src/services/news/
  ├─ sources.ts     la liste des flux, leurs thèmes par défaut, leur cadence
  ├─ fetcher.ts     appel HTTP + garde-fous (délai, taille, User-Agent)
  ├─ parser.ts      RSS 2.0 et Atom → une forme unique
  ├─ classify.ts    catégories de la source + mots-clés → nos thèmes
  ├─ ingest.ts      déduplication, insertion, purge
  └─ releases.ts    calendrier des sorties, depuis l'API YGOProDeck
                       │
              PostgreSQL : news_items, news_sources, user_news_topics
                       │
              GET /api/news          le fil, trié selon les abonnements
              GET /api/news/topics   les thèmes et l'état d'abonnement
              PUT /api/news/topics   s'abonner / se désabonner
              GET /api/news/releases le calendrier des sorties
                       │
      client/src/pages/News.tsx        mobile/src/app/(tabs)/news.tsx
```

### Les thèmes

Six, pas plus — au-delà, personne ne configure rien :

| Thème | Ce qu'il couvre |
|---|---|
| `tcg` | Annonces TCG, règles, produits occidentaux |
| `ocg` | Nouvelles japonaises, souvent en avance de plusieurs mois |
| `competition` | Tournois, résultats, decks du méta |
| `releases` | Nouvelles cartes, extensions, réimpressions |
| `banlist` | Listes limitatives — le sujet qui fait revenir les joueurs |
| `rulings` | Interactions et jugements |

### Comment un article reçoit son thème

Deux passes, dans cet ordre :

1. **Les catégories de la source**, quand elle en fournit — YGOrganization en
   met sur chaque article, c'est le signal le plus fiable.
2. **Des mots-clés dans le titre**, en filet de sécurité (« Forbidden & Limited
   List » → `banlist`, « YCS », « Regional », « Top 32 » → `competition`).

Un article sans thème reconnu tombe dans `tcg` s'il vient d'une source
Yu-Gi-Oh, et est **écarté** s'il vient d'une source multi-jeux comme Pojo. C'est
volontairement strict : mieux vaut rater un article que noyer le fil de
Pokémon.

### Ce que « s'abonner » veut dire

Ni un filtre dur, ni rien du tout : une **pondération**. Un thème suivi remonte
en tête du fil et son article le plus récent est mis en avant ; le reste reste
consultable en dessous. Un utilisateur qui n'a rien choisi voit tout, par ordre
chronologique.

Les notifications push sur un thème suivi sont une suite possible, hors de ce
plan.

---

## 5. Étapes

Heures de travail effectif à deux, comme les autres plans.

| # | Étape | Heures | Coût € | Livrable qui prouve que c'est fait |
|---|---|---|---|---|
| 1 | Migration SQL + sources + récupération et analyse des flux | 5 – 7 | 0 | Un script qui affiche les 30 derniers articles des trois flux |
| 2 | Classification par thème + déduplication + ingestion | 3 – 4 | 0 | Deux passes d'ingestion n'insèrent aucun doublon |
| 3 | API : fil, thèmes, abonnements | 3 – 4 | 0 | `GET /api/news` trie selon les abonnements de l'appelant |
| 4 | Calendrier des sorties (YGOProDeck) | 3 – 4 | 0 | Les sorties des 90 prochains jours, avec leur code d'extension |
| 5 | Page web `/actualites` | 5 – 7 | 0 | Fil lisible, abonnements modifiables, calendrier |
| 6 | Écran app | 4 – 6 | 0 | Même chose sur téléphone |
| 7 | Cron, quotas, cache, purge, déploiement | 2 – 3 | 0 | Le fil se met à jour seul en production |
| | **Total** | **25 – 35 h** | **0 €** | |

### Coût

**Zéro euro récurrent.** Aucun flux n'est payant, aucune API n'est facturée,
YGOProDeck est publique et sans authentification. Le stockage est négligeable :
quelques milliers de lignes de texte par an, purgées au-delà de six mois.

Le seul coût est le temps, et l'entretien : **un flux change ou meurt, tôt ou
tard**. La table `news_sources` porte donc le dernier succès et la dernière
erreur de chaque source, pour que la panne se voie au lieu de se traduire par un
fil qui se vide en silence.

### Dépendance ajoutée

Une seule : un analyseur XML. `fast-xml-parser` — sans dépendance transitive, et
capable de RSS 2.0 comme d'Atom, qui sont deux formats différents (`<item>` d'un
côté, `<entry>` de l'autre).

---

## 6. Avancement

- [ ] **Étape 1** — Migration, sources, récupération des flux
- [ ] **Étape 2** — Classification, déduplication, ingestion
- [ ] **Étape 3** — API et abonnements
- [ ] **Étape 4** — Calendrier des sorties
- [ ] **Étape 5** — Page web
- [ ] **Étape 6** — Écran app
- [ ] **Étape 7** — Cron et déploiement

---

## 7. Ce qui peut mal tourner

- **Un site bloque notre robot.** Reddit répond déjà 429 au deuxième appel. On
  s'identifie par un `User-Agent` explicite, on respecte une cadence lente, et
  une source qui échoue trois fois de suite est mise en sommeil au lieu d'être
  martelée.
- **Le fil se remplit de bruit.** C'est le risque de Pojo. La règle « pas de
  thème reconnu, pas d'article » le contient ; si ça ne suffit pas, on retire la
  source — elle n'est pas essentielle.
- **Tout est en anglais.** À dire dans l'interface. Une traduction automatique
  des titres serait possible via Claude, mais elle aurait un coût par article,
  contrairement à tout le reste de cette page — à décider séparément.
