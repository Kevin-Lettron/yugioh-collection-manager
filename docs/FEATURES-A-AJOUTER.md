# Features à ajouter — post-refonte v2

Liste des features présentes dans les maquettes Claude Design mais **absentes du code
actuel**. La refonte v2 sur `master` couvre uniquement la couche visuelle des pages
existantes ; les nouvelles capacités listées ici seront ajoutées sur cette branche
`dev-features` puis mergées quand elles sont prêtes.

Chaque item = un ticket. On les traite indépendamment.

---

## Mobile

### 1. FAB octogonal violet pour le scan
- **Où** : bottom-right de tous les écrans (tabs)
- **Comment** : `View` avec `clip-path` simulé (biseau via `borderRadius` + `overflow`), background `colors.violet`, ring pulsant en absolute
- **Nav** : router.push('/scan')
- **Fichier** : nouveau `mobile/src/components/decor/ScanFAB.tsx` + monté dans `(tabs)/_layout.tsx`
- **Effort** : 30 min

### 2. Sticky blur backdrop header
- Actuellement le header top est statique. Le maquette pose `backdrop-filter: blur(14px) saturate(180%)`.
- **RN équivalent** : `expo-blur` (paquet léger, ajouté à Expo Go de base)
- **Effort** : 45 min (installer expo-blur, wrapper le header)

### 3. Chip filter row horizontal au-dessus du grid Collection
- Chips scrollables horizontaux « Toutes 3214 / Monstres 1420 / Magies 908 / Pièges 632 »
- Alternative au modal Filtres actuel (le modal reste pour les filtres complexes)
- **Fichier** : nouveau `mobile/src/components/QuickFiltersBar.tsx`
- **Backend** : besoin d'un endpoint qui retourne les counts par type (ou calcul client)
- **Effort** : 2 h (dont endpoint backend)

### 4. Stats bar biseautée Collection (Ultra rares / Valeur estimée)
- 2 tuiles biseautées au-dessus du grid
- **Backend requis** : agrégation `GET /collection/stats` qui retourne `{ total, uniqueCards, ultraCount, estimatedValue }`
- **Prix estimé** : nécessite intégration prix (yugiohprices API ou similaire)
- **Effort** : 3 h (backend + composant)

### 5. Preview holo full-screen au tap long sur une carte
- Actuellement tap = ouvre le CardDetailModal. Le maquette prévoit un tap **long** qui ouvre une preview grand format avec effet holographique animé (gradient qui suit la souris/geste).
- **Composant** : nouveau `mobile/src/components/HoloPreview.tsx`
- **Gesture** : `react-native-gesture-handler` (LongPressGestureHandler)
- **Effort** : 3 h

### 6. Skeleton loaders (shimmer)
- Remplacer les `ActivityIndicator` central par des skeleton cards en shimmer pendant le loading initial de la Collection / Decks / Social feed
- **Composant** : nouveau `mobile/src/components/SkeletonCard.tsx` avec Reanimated animation
- **Effort** : 1 h

### 7. Répartition Main/Magies/Pièges en jauges horizontales (DeckView)
- Data-viz sous les stats du deck
- **Composant** : nouveau `mobile/src/components/decor/DeckBreakdown.tsx`
- **Data** : calculée depuis `deck.main_deck` (comptage par `card.type`)
- **Effort** : 1 h

### 8. Zone arène 3D perspective (DeckView, variante « Sanctuaire Draconique »)
- Visualisation immersive : 5 zones (Monstres × 2, Magies/Pièges, Terrain, Cimetière)
- **Ambitieux** : dessin de plateau de duel avec `transform: perspective` sur les slots
- **Effort** : 8 h (dessin + interactions)

### 9. Auto IA toolbar dans DeckEditor
- Bouton « Auto IA » sticky à droite du header, au lieu du CyberButton actuel dans la row d'actions
- **Effort** : 30 min (relocation UI)

### 10. Tabs de tri sur Social (Populaires / Récents / Suivis)
- Actuellement le feed a un seul tri par défaut
- **Backend** : query param `?sort=popular|recent|following`
- **Effort** : 1.5 h (backend + UI)

---

## Web

### 11. Compteurs qui montent (Home hero stats)
- IntersectionObserver + `requestAnimationFrame` pour animer les chiffres du 0 à la valeur finale quand la section devient visible
- **Fichier** : nouveau `client/src/hooks/useCountUp.ts`
- **Effort** : 45 min

### 12. Cartes flottantes autour de l'obélisque (Home hero)
- 3 mini-cartes qui lévitent en `f1/f2/f3` avec animations subtiles (translateY + rotate)
- **CSS** : keyframes `card-float` déjà partiellement dans theme.css
- **Effort** : 30 min

### 13. Grain animé sur body::after
- Overlay avec SVG turbulence en data-URI, `mix-blend-mode: overlay`, animation steps(6) sur 8 s
- Documenté dans la charte §8.4 mais pas encore appliqué sur le body web
- **Effort** : 15 min (juste CSS)

### 14. Halo doré underline sur mots-accent (Home hero)
- `::after` avec blur linear-gradient pour souligner « Sanctuaire » ou « Millénium »
- **Effort** : 30 min

### 15. Cue scroll « Descends » (Home hero)
- Indicateur animé en bas du hero qui invite au scroll
- **Effort** : 20 min

### 16. Chiffres réels sur la Home
- Actuellement en dur (13 240 / 2 847 / 18 906). Ajouter un endpoint `GET /stats/public`
- **Backend** : count total cartes en collections, total utilisateurs, total decks partagés
- **Effort** : 2 h (endpoint + intégration frontend + cache 5 min)

### 17. Page publique de visite ("Voir un deck public") depuis la Home
- Actuellement le lien du hero renvoie vers `/login`
- Créer un feed public en mode visiteur (utilise `/decks/public` sans auth via `optionalAuth`)
- **Effort** : 2 h

---

## Backend

### 18. Rareté par carte dans DeckCard
- Le type `Card` n'a pas de champ `rarity`. Les cartes dans un deck ne peuvent donc pas afficher leur rareté dans CardTile mobile ni web.
- Deux options : soit enrichir l'API `/decks/:id` pour retourner `rarity` par card (via join sur UserCard si owner), soit ajouter `rarity?: string` optionnel à `shared/types/Card`
- **Effort** : 2 h (schema + query)

### 19. Cache prix des cartes
- Nécessaire pour la stats bar Collection (#4 mobile)
- Intégration `yugiohprices.com` API + cache Redis/mémoire 24 h
- **Effort** : 4 h

---

## Priorité suggérée (utilité utilisateur × effort)

**Sprint 1** (2 j) : #11 compteurs, #12 cartes flottantes, #13 grain, #18 rareté deck cards, #6 skeleton loaders, #1 FAB scan mobile

**Sprint 2** (3 j) : #7 breakdown deck, #3 chip filter row, #10 tabs social, #17 page publique deck

**Sprint 3** (5 j+) : #4 stats bar + prix estimé, #5 preview holo long-press, #8 arène 3D, #19 cache prix

---

## Comment travailler sur cette branche

```bash
git checkout dev-features
# implémenter un ticket
git commit -m "feat: #N — description"
# quand un lot est prêt et testé
git checkout master
git merge dev-features
git push
```

Ou par ticket : un PR par item pour review propre.
