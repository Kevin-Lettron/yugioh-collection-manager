# Brief de refonte visuelle v2 — YuGiOh Collection

Document destiné à un agent de **design senior** pour proposer 3-4 directions visuelles
concurrentes, puis un design system + maquettes finales. À charge du designer de
proposer, argumenter, itérer.

---

## 1. Contexte produit

**Produit** : Web app (React + Vite + PWA) et app mobile (React Native / Expo) qui laissent
un joueur Yu-Gi-Oh gérer sa collection de cartes, construire des decks, partager,
commenter, et scanner ses cartes physiques via l'IA (Claude Vision).

**Utilisateur type** :
- 18-35 ans, joueur régulier Yu-Gi-Oh (collectionneur ou compétitif)
- Habitué à Discord / Reddit / apps mobiles modernes (Instagram, Notion, Linear)
- Il vient sur l'app parce que les alternatives existantes (YGOProDeck, DuelingBook, etc.)
  ont un design daté de 2010. Il attend **mieux** que ces sites, pas la même chose.

**Positionnement voulu** : « L'app qui donne à ta collection la vitrine qu'elle mérite. »
Pas un CRM de cartes, un **espace personnel qu'on montre**.

## 2. Ce qui est déjà fait (v1)

Une première refonte "cyberpunk" a été livrée :
- Palette **or (Millénium) + violet** en dark et light — voir [`palette.ts`](../mobile/src/theme/palette.ts)
  et [`theme.css`](../client/src/styles/theme.css)
- Composant **CyberButton** avec biseaux + ombre décalée + Orbitron uppercase + effet glitch
  au survol — voir [`Button.tsx`](../client/src/components/ui/Button.tsx) et
  [`CyberButton.tsx`](../mobile/src/components/CyberButton.tsx)
- Logo **Millennium Mark** (pyramide inversée + œil géométrique) en SVG maison, décliné
  en icône app, splash screen, favicon
- Icônes fonctionnelles SVG maison (Card, Deck, Scan, Search, Filter, etc.) —
  [`Icons.tsx`](../client/src/components/decor/Icons.tsx)
- Trame quadrillée dorée subtile + halo violet sur `body`

**On garde tout ça.** La v2 vient EN PLUS, pas EN REMPLACEMENT.

## 3. Ce qui manque et qui doit être livré en v2

Le user a validé la v1 mais la trouve « mignonne et propre, pas mémorable ». Il veut :

- ✨ **Une identité visuelle forte** — pas juste des couleurs et des boutons, un **univers**
- 🎨 **Des illustrations, des décorations, du grain** — la page ne doit pas être vide en dehors des composants
- 🎬 **Du mouvement** : parallax multi-couches, animations d'entrée, hover riches, transitions entre pages
- 📱 **Des icônes vraiment custom** — les emojis 🃏📚 dans la barre d'onglets mobile sont un scandale
- 🖼️ **Traiter les cartes YGO comme des œuvres**, pas comme des thumbnails de fiche produit

Le user aime **le style glitch cyberbutton** — le garder. Le reste est ouvert.

## 4. Contraintes techniques (à respecter absolument)

### Stack

| Plateforme | Techno | Contrainte visuelle |
|---|---|---|
| Web | React 18 + Tailwind + Vite + `vite-plugin-pwa` | CSS moderne OK (clip-path, mix-blend-mode, backdrop-filter, `@property`, animations CSS). Pas de canvas WebGL (perf + accessibilité). |
| Mobile | Expo SDK 54 + React Native 0.81 | **Pas de `react-native-svg`** (nécessiterait un rebuild natif custom). Les icônes doivent être soit des PNG rendues depuis SVG à la CI, soit dessinées avec `View + border`. Animations : `Animated` API ou `react-native-reanimated` (déjà installé). Pas de `react-native-skia` (trop lourd). |

### Assets

- **Aucune image officielle Konami** ne peut être réutilisée pour la décoration (copyright).
  Les cartes elles-mêmes viennent de l'API YGOProDeck et restent sous leur licence.
- Toute décoration doit être **originale** : dessin SVG maison ou photo générée / libre de
  droits (Unsplash / Pexels) ou générée IA (Midjourney / DALL-E) avec attribution
  documentée.
- Format max des assets : 500 KB par image pour le web (perf), 200 KB pour les assets
  bundled mobile.

### Perf

- LCP web < 2.5 s sur 4G (le user est mobile 60% du temps)
- Poids initial bundle web < 500 KB gzipped (actuellement ~130 KB, on a de la marge)
- Animations : 60 fps sur téléphone milieu de gamme (Samsung A5x, Pixel 6). Pas
  d'animation en boucle infinie hors halo/pulse discrets.
- **Prefers-reduced-motion** : si l'utilisateur l'a coché dans l'OS, désactiver
  parallax + animations d'entrée. Garder les transitions courtes (<300ms) et le glitch
  cyberbutton (n'est joué qu'au hover, jamais imposé).

### Accessibilité

- Contraste texte ≥ 4.5:1 sur toutes les surfaces (déjà OK dans la palette actuelle)
- Focus visible sur tous les interactifs (déjà OK sur `.cyber-btn`)
- Ne pas s'appuyer uniquement sur la couleur pour transmettre du sens (statuts banlist :
  ajouter icône en plus de la couleur)
- Toute animation qui déplace du contenu doit être annulable via reduce-motion

## 5. Périmètre : les écrans à concevoir

Par ordre d'importance :

1. **Home / Landing** (nouveau, n'existe pas encore) — page d'accueil pour visiteurs pas
   loggés, doit vendre le produit en 3 s
2. **Collection** — l'écran vu 90% du temps. Grid de cartes possédées.
3. **DeckView** (lecture) — présentation d'un deck : main / extra / side, likes, commentaires
4. **DeckEditor** — construction d'un deck depuis la collection
5. **Social feed** — decks publics, tri par popularité / récent
6. **Profile** (personnel et public)
7. **Login / Register**
8. **Scan** (mobile uniquement) — écran caméra + confirmation

Les autres (Admin, Followers, Notifications) suivent le même design system, pas besoin de
maquette dédiée.

## 6. Éléments à explorer par direction

Le designer doit proposer **3 à 4 directions distinctes**. Chaque direction se décrit
par ces axes :

### 6.1 Ambiance / atmosphère

Idées de départ, à combiner ou explorer autrement :
- **Sanctuaire arcane** — inspirations : temple égyptien × cyberpunk, glyphes géométriques,
  colonnes stylisées, lumières de rituel, poussière dorée qui flotte
- **Deep space** — nébuleuses violettes, cartes qui « lévitent » dans le vide, halos
  de particules, transitions type portail
- **Salle de duel underground** — bar / club, néons rasants, brumes basses, textures
  béton et métal brossé, ambiance nocturne urbaine
- **Codex vivant** — grimoire ouvert, pages qui se tournent en 3D léger, cartes comme
  runes activées, filigrane doré, encre qui se dépose

### 6.2 Typographie

- Titres : **Orbitron** est déjà installé (dispo dans la v1). Le designer peut proposer
  une variante (Chakra Petch, Rajdhani déjà là, Space Grotesk, Audiowide). Garder une
  seule famille display.
- Corps : Rajdhani installé aussi. Alternatives OK si serve `font-src 'self'` (auto-hébergé).
- Chiffres : privilégier **variantes tabulaires** pour les compteurs de deck (40/60,
  15/15, ATK/DEF)

### 6.3 Motion / animations

Types d'animations attendus :
- **Entrée de page** : stagger cards fade + translate Y, 400ms cubic-bezier(.2, .8, .2, 1)
- **Hover carte** : tilt 3D léger (transform: rotate3d), glow doré, quantity badge qui
  gonfle un peu
- **Parallax** : min 2 couches sur Home et Collection (fond, mid-ground)
- **Transitions entre routes** : fade + shift léger (300ms), pas de wipe agressif
- **Scan mobile** : au tap capture, animation de « lock » qui verrouille sur la carte
  avec 4 coins qui se rejoignent
- **AI Deck Builder** : pendant le loading, animation de particules qui « composent » le deck

Le designer peut proposer autres — s'abstenir de gimmick (aucun rotation infinie de logo).

### 6.4 Traitement des cartes

Actuellement chaque carte est une image plate dans une grille. À réinventer :
- **Halo dynamique** selon rareté (Common = gris subtle, Ultra Rare = doré vibrant,
  Secret Rare = arc-en-ciel)
- **Micro badges** sur la carte : quantité, langue en drapeau stylisé, banlist
- **État "possédée" vs "wishlist"** visuellement distinct au premier coup d'œil
- **Hover / tap long** : preview grand format avec effet holographique (mix-blend-mode
  overlay + gradient qui suit la souris)

### 6.5 Décoration structurelle

Éléments graphiques récurrents à définir :
- **Bordures de cadre** — motif style Art Déco égyptien × sci-fi (ex. angles biseautés
  avec petits triangles or)
- **Séparateurs** — ligne dégradée or → transparent avec un glyphe au centre
- **Coins d'écran** — angles décoratifs SVG en overlay
- **Textures de fond** — grain fin (film grain), micro-lignes de circuit, hiéroglyphes
  géométriques faits à la main
- **Illustrations custom** pour les états vides ("Aucune carte", "Aucun deck") — pas
  d'illustration stock

## 7. Direction visuelle recommandée par nous (à défier ou confirmer)

**« Sanctuaire du Millénium »** — croisement temple égyptien × cyberpunk arcane.

- Palette or / violet conservée, +un touch cyan pour les accents info
- Motifs : glyphes géométriques (triangles, œil, cercles emboîtés) rappelant les
  objets du Millénium sans reprendre les designs Konami
- Parallax de temple : au scroll, colonnes en arrière-plan qui défilent lentement,
  particules dorées au premier plan
- Cartes présentées comme des artefacts posés sur des socles avec ombre projetée
- Ambiance mystique mais lisible — pas noir uni sombre, plutôt dégradé du bleu nuit
  au violet foncé avec halos ambrés

Le designer peut proposer autre chose s'il argumente.

## 8. Références externes (inspirations)

À regarder pour se caler sur le niveau de finition attendu :
- **Linear.app** — animations discrètes, ombres portées travaillées, typo maîtrisée
- **Vercel.com** — parallax subtil, dégradés, focus sur le contenu
- **Cyberpunk.game** — glitch, néons, hiérarchie visuelle nette
- **Arcane (Netflix) — kit presse** — mélange 2D animé × grain
- **MidJourney gallery** avec prompts "art deco egyptian cyberpunk"
- Sites de projets ArtStation étiquetés "Yu-Gi-Oh fan art" pour l'ambiance non-officielle

## 9. Livrables attendus du designer

1. **Moodboard** (1 page par direction) — 6-12 images de référence + palette + typo +
   3 mots-clés d'ambiance
2. **Design system étendu** :
   - Nouveaux tokens (au-delà des couleurs actuelles) : elevation, motion durations,
     motion easings, grain, blur
   - Bibliothèque décoration (bordures, séparateurs, coins, glyphes)
3. **Maquettes haute-fidélité** des 8 écrans, format Figma ou HTML statique
4. **Prototype animé** de la Home et de la Collection (Figma, ou HTML + CSS)
5. **Doc de handoff** : justification des choix, guide d'implémentation, assets exportés
   (SVG + PNG × 1, 2, 3, plus WebP pour photos)

## 10. Ce que nous, on fera derrière

- Découper le design en tickets d'implémentation
- Coder l'HTML/CSS + React web (spécificité : Tailwind + tokens CSS déjà en place)
- Adapter en React Native (contrainte : pas de `react-native-svg`, pas de `react-native-skia`)
- Créer les assets manquants (icônes tabs mobile en priorité)

Le designer ne code pas, il livre les specs et les assets.

## 11. Timeline suggérée

| Étape | Effort | Livrable |
|---|---|---|
| Moodboard × 3-4 directions | 1-2 jours | Sélection d'UNE direction par le user |
| Design system étendu | 2 jours | Tokens + composants Figma |
| Maquettes hi-fi | 3-5 jours | Les 8 écrans validés |
| Prototype animé | 1 jour | Home + Collection en démo |
| Handoff | 0.5 jour | Doc + assets |
| **Total** | **~10 jours** | **Prêt pour implémentation** |

## 12. Questions ouvertes pour le designer

À trancher avec lui :
- Est-ce qu'on ajoute une **page Landing** publique séparée de l'app authentifiée, ou on
  garde /login comme point d'entrée ?
- Est-ce qu'on veut **un mode arène** pour DeckView (simulation d'un plateau de duel) ou
  la vue reste une liste classique ?
- Faut-il un **thème alternatif** en plus de dark/light (ex. thème "monde des ombres" ou
  "monde de rêve") ?
- Faut-il faire une **skin par archétype** (Blue-Eyes, Dark Magician, etc.) selon les
  cartes dominantes du deck consulté ?

## 13. Ce qui n'est PAS négociable

- La palette or + violet reste (marque)
- Le CyberButton reste tel quel (utilisé partout, remplacer casserait tout)
- Sombre par défaut (le user a explicitement demandé récemment)
- Le logo Millennium Mark reste (déjà déployé comme icône d'app + favicon)
- Pas de dépendance native supplémentaire sur mobile (pas de rebuild EAS custom)
- Pas de framework CSS lourd en plus de Tailwind (pas de Bootstrap, Material, etc.)

---

## Comment utiliser ce brief

1. Copie le contenu et donne-le à un agent design (Claude / GPT-4 avec instruction
   « designer senior »). Précise : « Propose 3 directions, argumente chacune en 200
   mots, puis attends mon choix. »
2. Après choix, demande à l'agent de développer les livrables §9 point par point.
3. Reviens avec les résultats — on découpe en tickets et on implémente.
