# Charte graphique — YuGiOh Collection Manager

**Direction visuelle validée : « Sanctuaire du Millénium »** — croisement temple
égyptien × cyberpunk arcane. Or du Millénium dominant, violet mystique en secondaire,
sombre dense par défaut, décor géométrique dessiné à la main, motion réservé aux
moments-clés.

Ce document est la **source de vérité** de l'identité visuelle. Toute nouvelle page
ou composant doit s'y référer. Il complète le brief `BRIEF-REFONTE-V2.md` (positionnement)
et sert de spec pour l'implémentation web + mobile.

---

## Table des matières

1. [Manifeste visuel](#1-manifeste-visuel)
2. [Palette étendue](#2-palette-étendue)
3. [Typographie](#3-typographie)
4. [Iconographie](#4-iconographie)
5. [Composants clés](#5-composants-clés)
6. [Motion & animations](#6-motion--animations)
7. [Layout & rythme](#7-layout--rythme)
8. [Décoration structurelle](#8-décoration-structurelle)
9. [Traitement des cartes YGO](#9-traitement-des-cartes-ygo)
10. [Photographie & illustrations](#10-photographie--illustrations)
11. [Voix éditoriale](#11-voix-éditoriale)
12. [Do & Don't](#12-do--dont)
13. [Guide d'implémentation web](#13-guide-dimplémentation-web)
14. [Guide d'implémentation mobile](#14-guide-dimplémentation-mobile)
15. [Checklist de validation](#15-checklist-de-validation)

---

## 1. Manifeste visuel

### 1.1 Trois mots

**Sacré. Vivant. Précis.**

- **Sacré** : chaque élément a un poids rituel. Rien ne flotte au hasard. Les proportions
  sont exactes (grille 8), les alignements durs, les biseaux à angle constant (45°).
- **Vivant** : le décor bouge lentement (particules dorées qui flottent, glyphes en
  parallax, halos qui pulsent). Jamais figé.
- **Précis** : angles vifs, pas d'arrondi doux, ombres nettes, typographie
  monospace-adjacent (Orbitron). L'inverse de la mollesse "material design".

### 1.2 Ce qu'on veut faire ressentir

L'utilisateur ouvre l'app comme il ouvrirait un coffre de duelliste. Sa collection
mérite un socle. La rareté d'une Secret Rare doit se voir avant même de lire le nom.
On ne consulte pas un CRM de cartes, on **invoque son deck**.

### 1.3 Ce qu'on refuse

- **Le "material" plat** aux boutons arrondis, ombres douces, animations d'atterrissage
  ballon. C'est Google Keep, pas le sanctuaire.
- **Le "premium bank"** style Revolut/N26 minimaliste blanc pastel. On n'est pas une
  fintech.
- **Le "gaming toxique"** avec fonts illisibles italiques et néons violents. On veut
  du mystère, pas du bruit.
- **Le "hollywood cyberpunk"** de 2020 avec chromatic aberration partout et scanlines
  agressives.

---

## 2. Palette étendue

Toutes les valeurs sont exprimées en **hex** pour la doc et en **CSS variables** dans
`client/src/styles/theme.css` + **objet TypeScript** dans `mobile/src/theme/palette.ts`.

### 2.1 Sombre (défaut)

| Token | Hex | Rôle | Où l'utiliser |
|---|---|---|---|
| `--bg-0` | `#050307` | Fond ultra-profond | Body en tête, splash screen |
| `--bg-1` | `#0B0813` | Fond de page | Zone principale, sous navbar |
| `--bg-2` | `#14101C` | Fond élévé | Barres, en-têtes, footer |
| `--panel` | `#1A1424` | Panneau standard | Cards, modales, tuiles |
| `--panel-2` | `#22182F` | Panneau imbriqué | Sub-cards, states hover panel |
| `--border` | `#3A2B4C` | Bordure standard | Séparateurs, bordures cards |
| `--border-gold` | `#4A3C1E` | Bordure or discrète | Bords secondaires or |
| `--text` | `#F5EFE0` | Texte principal | 90% du texte |
| `--text-muted` | `#A99C86` | Texte secondaire | Sub-titres, hints, labels |
| `--text-dim` | `#6B5E45` | Texte tertiaire | Timestamps, fine print |
| `--gold` | `#F5C518` | **Or Millénium** — primaire | CTAs, focus, marque, valeurs |
| `--gold-dim` | `#C29A0F` | Or assombri | Hover states or, dégradés |
| `--gold-glow` | `rgba(245, 197, 24, 0.35)` | Halo or | box-shadow, filter drop-shadow |
| `--violet` | `#A855F7` | **Violet mystique** — secondaire | Ombres cyber, accents secondaires |
| `--violet-glow` | `rgba(168, 85, 247, 0.35)` | Halo violet | Halos, hero radial |
| `--cyan` | `#22D3EE` | Accent info | Focus rings, tags AI, liens |
| `--magenta` | `#FF2E88` | Alerte rare | Notifications, badges tag |
| `--success` | `#34D399` | Succès | Toasts confirm, banlist ok |
| `--danger` | `#FF4D6D` | Erreur, destructif | Delete, banlist banned |
| `--grid` | `rgba(245, 197, 24, 0.06)` | Trame de fond | Lignes du quadrillage body |
| `--hieroglyph` | `rgba(168, 85, 247, 0.04)` | Motif décor | Pattern zones vides cards |
| `--on-gold` | `#0B0906` | Texte sur or | Labels boutons or |

### 2.2 Clair (bascule)

Rôles identiques, valeurs adaptées au contraste :

| Token | Hex clair |
|---|---|
| `--bg-0` | `#F0EBDD` |
| `--bg-1` | `#F7F3EA` |
| `--panel` | `#FFFFFF` |
| `--panel-2` | `#F2ECDD` |
| `--border` | `#DCCFB0` |
| `--text` | `#1A1206` |
| `--text-muted` | `#6B5E45` |
| `--gold` | `#8A6D0B` |  ← l'or néon tombe à 1.8:1 sur fond clair, illisible |
| `--violet` | `#7C3AED` |
| `--on-gold` | `#FFFFFF` |

### 2.3 Répartition — règle du 60/30/10

- **60 % surfaces sombres** (`--bg-*`, `--panel-*`)
- **30 % texte et bordures** (`--text-*`, `--border-*`)
- **10 % accents** répartis : 7 % or (marque), 2 % violet, 1 % cyan/magenta

Une page qui saigne l'or partout est déjà cassée. Un CTA en or par écran, deux max.

### 2.4 Rareté YGO (couleurs sémantiques cartes)

| Rareté | Couleur halo | Effet |
|---|---|---|
| Common | `rgba(255,255,255,0.05)` | Ombre inset discrète 1 px |
| Rare | `rgba(59,130,246,0.4)` | Bordure inset 1 px + glow bleu 15 px |
| Super Rare | `rgba(168,85,247,0.5)` | Bordure violet + glow 25 px |
| Ultra Rare | `var(--gold)` | Bordure or + glow 30 px + shimmer 3 s |
| Secret Rare | Multi | Bordure magenta + glow cyan + gradient holographique 4 s |
| Ghost Rare | `rgba(180,180,255,0.6)` | Bordure spectrale + double glow |
| Starlight | Prismatique | Gradient qui shift 8 s |

---

## 3. Typographie

### 3.1 Familles

| Rôle | Famille | Poids | Où |
|---|---|---|---|
| **Display** — titres, boutons, chiffres marquants | `Orbitron` | 500 / 700 / 900 | H1, H2, `.cyber-btn`, `.stat-value`, badges rareté |
| **Body** — texte courant | `Rajdhani` | 400 / 500 / 600 / 700 | Paragraphes, labels, inputs |
| **Arcane** — accents mystiques | `Cormorant Garamond` | 500 italique / 700 | Sous-titres arcanes, ornements Cormorant italique |

Toutes **auto-hébergées** via `@fontsource/*` — jamais de Google Fonts CDN (CSP `font-src 'self'`).

### 3.2 Échelle

| Niveau | px | Line-height | Usage |
|---|---|---|---|
| Display XL | 68 | 0.95 | Hero home only |
| Display L | 48 | 1.0 | Hero secondary pages |
| H1 | 32 | 1.1 | Section title |
| H2 | 24 | 1.2 | Sub-section |
| H3 | 18 | 1.3 | Card title, modal title |
| Body Large | 16 | 1.55 | Description longue |
| Body | 14 | 1.5 | Défaut |
| Small | 12 | 1.4 | Labels, hints |
| Micro | 10 | 1.2 | Badges, tags, uppercase |

### 3.3 Règles d'usage

- **Orbitron uppercase avec letter-spacing 0.14em** pour tous les CTAs et titres
  courts. Pas d'Orbitron minuscules — il est fait pour crier.
- **Cormorant Garamond italique** UNIQUEMENT pour les ornements narratifs
  (« — Vitrine du Millénium — »). Jamais pour du body.
- **Rajdhani body** normal (400), 15px, line-height 1.55. Confortable à lire, pas
  fatiguant.
- **Chiffres = variantes tabulaires** dès qu'ils comptent (deck 40/60, ATK 3000, etc.).
  `font-variant-numeric: tabular-nums;`
- **Jamais de font-style italic sur Orbitron ou Rajdhani** (elles n'ont pas d'italiques
  dessinées, tu obtiendrais du faux italique moche).

### 3.4 Exemple code

```css
.hero-title {
  font-family: 'Orbitron', sans-serif;
  font-size: clamp(38px, 6vw, 68px);
  font-weight: 900;
  letter-spacing: 0.04em;
  line-height: 0.95;
  text-transform: uppercase;
  background: linear-gradient(180deg, var(--text) 0%, var(--gold-dim) 100%);
  -webkit-background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 20px rgba(245, 197, 24, 0.15));
}
.hero-title .arcane {
  display: block;
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-size: 0.35em;
  font-weight: 500;
  letter-spacing: 0.3em;
  color: var(--gold);
  margin-bottom: 12px;
  text-transform: uppercase;
  -webkit-text-fill-color: currentColor;
}
```

---

## 4. Iconographie

### 4.1 Principes

- **Grille 24 × 24 systématique** — jamais d'icônes en dehors de cette grille.
- **Trait 1.6 stroke, `linejoin: miter`, `linecap: butt`** — pas d'arrondi.
- **`fill: none` + `stroke: currentColor`** — l'icône hérite de la couleur du contexte.
- **Angles vifs**, jamais de border-radius interne.
- **Motifs YGO originaux** — pyramide inversée, œil géométrique, cercles concentriques.
  Aucun asset officiel Konami.

### 4.2 Catalogue actuel (extensible)

Fichier source : `client/src/components/decor/Icons.tsx`

| Nom | Usage |
|---|---|
| `MillenniumMark` | Logo produit — pyramide inversée + œil |
| `CardIcon` | Carte générique |
| `DeckIcon` | Deck / pile de cartes |
| `ScanIcon` | Scan caméra |
| `SocialIcon` | Feed communauté |
| `SearchIcon` | Recherche |
| `FilterIcon` | Filtres |
| `AddIcon` | Ajouter |
| `AlertIcon` | Alerte |
| `CheckIcon` | Validé |
| `SunIcon`, `MoonIcon` | Bascule thème |

### 4.3 À dessiner en v2

**Priorité absolue — icônes bottom tab bar mobile** (actuellement emojis 🃏📚, à
remplacer avant tout autre chantier) :

- `TabCollectionIcon` — trois cartes empilées avec un décalage, angles vifs
- `TabDecksIcon` — livre ouvert / triangle avec 3 lignes horizontales
- `TabSocialIcon` — 3 nodes reliés en triangle
- `TabProfileIcon` — silhouette géométrique triangulaire (variante simplifiée du logo)

**Glyphes décoratifs** (utilisés dans les couches parallax) :

- `GlyphEye` — œil oblong avec cercle intérieur (déjà dans maquette)
- `GlyphAnkh` — croix ansée stylisée géométrique
- `GlyphPyramid` — triangle plein avec ligne médiane
- `GlyphScarab` — scarabée géométrique (nouveau)
- `GlyphLotus` — lotus stylisé (nouveau)

**Illustrations d'états vides** (à dessiner pour la refonte) :

- Empty Collection — un socle vide avec un halo doré (« Ta vitrine attend sa
  première pièce »)
- Empty Deck — un livre fermé avec sceau or (« Commence ton grimoire »)
- Empty Wishlist — une main ouverte stylisée
- Empty Notifications — un œil fermé stylisé

### 4.4 Exemple SVG

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
     stroke-linejoin="miter">
  <path d="M5 3 H16 L19 6 V21 H5 Z" />
  <path d="M8 8 H16 M8 12 H16 M8 16 H13" stroke-width="1.2" />
</svg>
```

---

## 5. Composants clés

### 5.1 CyberButton (déjà existant, ne pas modifier)

**Rôle** : action primaire d'une zone. Coins biseautés au clip-path, ombre décalée
violet, glitch au hover réservé aux CTAs principaux.

**Variants** : `primary` (or), `secondary` (violet), `danger` (magenta), `ghost`
(bordure or transparent)

**Tailles** : `sm` (40 px height), `md` (48 px default), `lg` (56 px hero)

**Règle glitch** : max **1 bouton `glitch`** par écran (l'action principale). Un
écran avec 2 glitch = tu détruis la hiérarchie.

**Code web** : voir `client/src/components/ui/Button.tsx`
**Code mobile** : voir `mobile/src/components/CyberButton.tsx`

### 5.2 CyberPanel (à créer / étendre)

Panneau conteneur avec biseaux, bordure or discrète, ombre inset subtile.

```css
.cyber-panel {
  background: linear-gradient(135deg, var(--panel), var(--panel-2));
  border: 1px solid var(--border);
  clip-path: polygon(
    0 0, 100% 0,
    100% calc(100% - 14px), calc(100% - 14px) 100%,
    14px 100%, 0 calc(100% - 14px)
  );
  padding: 20px 24px;
  position: relative;
}
/* Liseré or gauche discret */
.cyber-panel::before {
  content: '';
  position: absolute;
  left: 0; top: 0;
  width: 3px; height: 100%;
  background: var(--gold);
  opacity: 0.6;
}
```

### 5.3 CardTile (à créer)

La tuile de carte YGO. **Le composant le plus important du produit.**

Anatomie :
- Container `aspect-ratio: 59/100` (proportions carte YGO officielles)
- Image de carte en background
- Badge quantité en overlay top-right (biseauté, or)
- Drapeau langue en overlay top-left
- Halo dynamique selon rareté (voir §9)
- Tilt 3D au hover (`rotate3d(1, -1, 0, 8deg)`)
- Overlay `radial-gradient` qui suit la souris (mix-blend-mode: overlay)

```css
.card-tile {
  aspect-ratio: 59 / 100;
  perspective: 1000px;
  cursor: pointer;
}
.card-tile__inner {
  width: 100%; height: 100%;
  transform-style: preserve-3d;
  transition: transform 320ms cubic-bezier(.2, .8, .2, 1);
}
.card-tile:hover .card-tile__inner {
  transform: rotateY(-8deg) rotateX(4deg) scale(1.05);
}
```

### 5.4 StatsBar (à créer)

Barre de 4 statistiques compactes, biseautée, séparateurs 1 px `--border`.

```html
<div class="stats-bar">
  <div class="stat">
    <div class="stat-label">Cartes totales</div>
    <div class="stat-value accent">3 214</div>
    <div class="stat-trend">+ 47 ce mois</div>
  </div>
  <!-- répéter -->
</div>
```

Design :
- Container avec `clip-path` biseau bottom-right
- Chaque `.stat` a un liseré or gauche
- `.stat-value` en Orbitron 32px tabular-nums
- `.stat-trend` en success ou danger selon delta

### 5.5 Chip / FilterChip

Puce cliquable pour filtres, avec biseau `polygon(0 0, calc(100% - 8px) 0, 100% 100%, 8px 100%)`.

- État `default` : bordure `--border`, texte muted
- État `hover` : bordure or-dim
- État `active` : background gradient or → gold-dim, texte on-gold

### 5.6 NavBar (top web)

Barre sticky avec :
- `backdrop-filter: blur(14px) saturate(180%)`
- Background semi-transparent `rgba(11, 8, 19, 0.85)`
- Logo animé (breath, drop-shadow gold)
- Nav links Orbitron uppercase 12px
- Actions à droite (search, notif, avatar) en boutons biseautés

### 5.7 TabBar (bottom mobile)

Bottom tab bar avec biseau haut-gauche/droit, 4 tabs, indicator or animé.

Icônes CUSTOM (voir §4.3), jamais d'emojis.

### 5.8 FAB (Floating Action Button)

Bouton flottant octogonal or, avec ring pulsant, positionné bottom-right.

```css
.fab {
  width: 72px; height: 72px;
  background: linear-gradient(135deg, var(--gold), var(--gold-dim));
  clip-path: polygon(
    0 20%, 20% 0, 80% 0, 100% 20%,
    100% 80%, 80% 100%, 20% 100%, 0 80%
  );
  box-shadow: 0 8px 40px var(--gold-glow), 0 4px 12px rgba(0,0,0,0.4);
}
.fab::before {
  /* ring qui pulse */
  content: '';
  position: absolute;
  inset: -6px;
  border: 1px solid var(--gold);
  clip-path: [même octogone];
  animation: fabRing 3s ease-out infinite;
}
```

### 5.9 Comment Thread

Fil de commentaires avec :
- Avatar géométrique (hexagone dégradé) 40 px
- Bordure `border-left: 2px solid --border` pour réponses imbriquées
- Timestamp en `--text-dim` italique
- Actions inline en `--gold` sur hover

---

## 6. Motion & animations

### 6.1 Tokens

```css
:root {
  --easing: cubic-bezier(.2, .8, .2, 1);      /* défaut, "confiant" */
  --easing-in: cubic-bezier(.4, 0, 1, 1);     /* sortie de scène */
  --easing-out: cubic-bezier(0, 0, .2, 1);    /* entrée de scène */
  --duration-fast: 180ms;                     /* micro-interactions */
  --duration-mid: 320ms;                      /* hover, focus */
  --duration-slow: 600ms;                     /* entrée de page */
  --duration-lag: 1200ms;                     /* halos, breath */
}
```

### 6.2 Catalogue d'animations

| Animation | Trigger | Durée | Easing | Où |
|---|---|---|---|---|
| **Grain animé** | Loop | 8 s | steps(6) | body::after, overlay léger |
| **Glyph float** | Loop | 12 s | ease-in-out | Glyphes parallax |
| **Corner pulse** | Loop | 4 s | ease-in-out | Ornements de coin |
| **Brand breath** | Loop | 4 s | ease-in-out | Logo Millennium |
| **Card in** (stagger) | Mount | 600 ms | var(--easing) | Cartes de collection, delay = i × 40 ms |
| **Tilt 3D** | Hover carte | 320 ms | var(--easing) | Card tile |
| **Glow follow mouse** | Hover carte | 320 ms | var(--easing) | Overlay radial |
| **Ultra shimmer** | Loop (cartes Ultra) | 3 s | ease-in-out | box-shadow variation |
| **Holo shift** | Loop (cartes Secret) | 4 s | linear | Gradient X translation |
| **Glitch button** | Hover glitch | 600 ms | steps(4) | `::after` transform + hue-rotate |
| **FAB ring** | Loop | 3 s | ease-out | Anneau qui se dissout |
| **Fab pulse** | Loop | 3 s | ease-in-out | box-shadow variation |
| **Route transition** | Nav | 300 ms | var(--easing) | Fade + shift Y de 8 px |
| **Modal open** | Show | 240 ms | var(--easing) | Scale from 0.94 + fade |

### 6.3 Parallax

**Web** : mouse-move + scroll, JS avec `requestAnimationFrame` throttled.

```js
const layers = document.querySelectorAll('.parallax-layer');
addEventListener('mousemove', e => {
  const mx = (e.clientX / innerWidth - 0.5) * 20;
  const my = (e.clientY / innerHeight - 0.5) * 20;
  layers.forEach(l => {
    const d = parseFloat(l.dataset.depth || 0.2);
    l.style.transform = `translate3d(${mx * d}px, ${my * d}px, 0)`;
  });
});
```

**Mobile** : simplifié, uniquement au scroll (accelerometer ne vaut pas la batterie).
2 couches max.

### 6.4 Prefers-reduced-motion

**OBLIGATOIRE** — chaque animation doit avoir son garde :

```css
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; }
  .parallax-layer { transform: none !important; }
  /* garder les transitions courtes (< 300 ms) pour ne pas rendre l'UI cassante */
}
```

Le glitch button reste actif — il n'est joué qu'au hover explicite, jamais imposé.

---

## 7. Layout & rythme

### 7.1 Grille

- **Grille 8** — toute mesure est un multiple de 8 (padding, margin, gap)
- **Container max-width : 1400 px** (au-delà : marges augmentent, contenu reste 1400)
- **Padding page** : `40px 32px 80px` desktop, `24px 16px 100px` mobile

### 7.2 Espacements

| Token | px | Usage |
|---|---|---|
| `spacing-1` | 4 | Micro |
| `spacing-2` | 8 | Gap chip |
| `spacing-3` | 12 | Gap card |
| `spacing-4` | 16 | Padding card |
| `spacing-5` | 24 | Section internal |
| `spacing-6` | 32 | Section external |
| `spacing-7` | 48 | Section major |
| `spacing-8` | 64 | Hero padding |

### 7.3 Breakpoints

| Breakpoint | Width | Comportement |
|---|---|---|
| `mobile` | < 640 px | Grid 1-2 col, navbar cachée, FAB visible |
| `tablet` | 640–1024 px | Grid 3 col, navbar réduite |
| `desktop` | 1024–1400 px | Grid 4-5 col, layouts 2-col sidebar |
| `wide` | ≥ 1400 px | Container cappé, marges extérieures |

---

## 8. Décoration structurelle

### 8.1 Ornements de coin

4 coins d'écran en SVG, position `fixed`, opacité 0.35–0.55, animation pulse discrète.

Motif : cadre égyptien géométrique (voir `#i-corner` dans les maquettes) — angle biseauté
avec petit rectangle décoratif intérieur + 2 cercles.

**Usage** : présent sur toutes les pages authentifiées. **PAS** sur la Home (le hero
porte le poids visuel), **PAS** sur les modales full-screen.

### 8.2 Glyphes flottants (parallax)

Fond parallax avec 2 couches de glyphes :
- Couche fond (`depth: 0.15`) : 3-4 glyphes de 80-110 px, opacité 0.08
- Couche mid (`depth: 0.30`) : 1-2 glyphes de 40-50 px, opacité 0.08 gold ou violet

Glyphes utilisés : pyramide, œil, ankh, lotus, scarabée. Répartis sans symétrie.

### 8.3 Trame de fond

Sur `body` :
```css
background:
  radial-gradient(ellipse 80% 60% at 50% -10%, rgba(168, 85, 247, 0.18), transparent 60%),
  radial-gradient(ellipse 40% 40% at 10% 100%, rgba(245, 197, 24, 0.06), transparent 60%),
  linear-gradient(var(--grid) 1px, transparent 1px),
  linear-gradient(90deg, var(--grid) 1px, transparent 1px),
  linear-gradient(180deg, var(--bg-0), var(--bg-1) 50%, var(--bg-0));
background-size: 100% 100%, 100% 100%, 44px 44px, 44px 44px, 100% 100%;
background-attachment: fixed;
```

3 gradients (halo violet haut, halo or bas-gauche, gradient vertical) + trame 44 × 44.

### 8.4 Grain

Overlay `body::after` avec SVG turbulence en data-URI, `mix-blend-mode: overlay`,
opacité 0.05, animation `steps(6)` sur 8 s.

Rend l'image texturée sans images externes.

### 8.5 Séparateurs

Ligne dégradée `--gold` → transparent, hauteur 1 px, avec un glyphe SVG au centre en
option.

```html
<hr class="cyber-sep"/>
<hr class="cyber-sep with-glyph" data-glyph="ankh"/>
```

---

## 9. Traitement des cartes YGO

**L'élément le plus important du produit.** Une carte n'est pas un thumbnail — c'est
une pièce présentée.

### 9.1 Halos par rareté

Voir §2.4. Implémentation :

```css
.card-tile.common .card-art { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05); }
.card-tile.rare .card-art {
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.4),
              0 0 20px rgba(59, 130, 246, 0.15);
}
.card-tile.super .card-art {
  box-shadow: inset 0 0 0 1px rgba(168, 85, 247, 0.5),
              0 0 25px rgba(168, 85, 247, 0.25);
}
.card-tile.ultra .card-art {
  box-shadow: inset 0 0 0 1px var(--gold), 0 0 30px var(--gold-glow);
  animation: ultraShimmer 3s ease-in-out infinite;
}
.card-tile.secret .card-art {
  box-shadow: inset 0 0 0 1px var(--magenta),
              0 0 12px rgba(255, 46, 136, 0.4),
              0 0 30px rgba(34, 211, 238, 0.3);
}
.card-tile.secret .card-art::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(115deg,
    transparent 20%, rgba(255,46,136,0.15) 30%,
    rgba(245,197,24,0.15) 45%, rgba(34,211,238,0.15) 60%,
    transparent 70%);
  mix-blend-mode: overlay;
  animation: holoShift 4s linear infinite;
}
```

### 9.2 Micro badges

**Position** :
- Quantité : top-right, biseauté, or, avec `× N`
- Langue : top-left, drapeau stylisé
- Banlist : bottom-left, icône ⛔ si banned, ⚠ si limited (à ajouter dans le catalogue
  d'icônes)

**Format** :

```css
.card-qty {
  position: absolute; top: 8px; right: 8px;
  padding: 4px 10px;
  background: linear-gradient(135deg, var(--bg-0), var(--panel));
  border: 1px solid var(--gold);
  color: var(--gold);
  font-family: 'Orbitron'; font-size: 10px; font-weight: 700;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 6px 100%, 0 calc(100% - 6px));
  box-shadow: 0 0 8px var(--gold-glow);
}
```

### 9.3 État "wishlist"

Cartes en wishlist (pas encore possédées) : opacité 0.6, filtre grayscale 0.5,
bordure pointillée or, badge `☆ WISH` overlay center bottom.

### 9.4 Hover / preview

Grand format modal au tap long / hover extended : carte en 400 px hauteur, avec
effet holographique intensifié (mix-blend-mode `plus-lighter` sur un gradient qui
suit la souris).

---

## 10. Photographie & illustrations

### 10.1 Photos externes

**Aucune** dans la v2. Toute la texture vient du décor SVG + grain + gradients.

### 10.2 Illustrations custom à commissioner

**Uniquement pour les états vides et la Home.** Style : ligne 1.6 px, angles vifs,
palette or + violet + noir. Format SVG optimisé (< 20 KB par illustration).

- Home hero : obélisque (fait) + 3 cartes flottantes autour
- Empty Collection : socle vide avec halo doré
- Empty Deck : livre fermé scellé
- Empty Wishlist : main tendue
- 404 : œil fermé stylisé

### 10.3 Cartes YGO officielles

Les images des cartes viennent de l'API YGOProDeck (`images.ygoprodeck.com`). Ne
JAMAIS modifier ces images, uniquement les mettre en scène (cadre, halo, badges).

---

## 11. Voix éditoriale

### 11.1 Ton général

Sérieux, un peu grave, jamais infantilisant. On ne dit pas « Oups! », on dit
« Requête invalide ». Ni sarcastique ni sec — factuel, minéral.

### 11.2 Vocabulaire arcane

Certains labels prennent une teinte narrative :

| Contexte technique | Formulation adoptée |
|---|---|
| Login | « Entrer dans le sanctuaire » |
| Register | « Rejoindre le sanctuaire » |
| Home hero | « Ta collection mérite une vitrine » |
| Ta collection | « Vitrine du Millénium » (sous-titre arcane) |
| Deck | « Grimoire » (occasionnellement) |
| Card | « Pièce » (pas systématique) |
| Deck en vedette | « Deck en vedette » (rester lisible) |
| Empty collection | « Ta vitrine attend sa première pièce » |
| Loading | « Invocation… » (max 1 fois par écran) |

Ne pas surdoser. Un ornement Cormorant italique par écran, deux max. Si tous les
labels sont « arcane », ça devient parodique.

### 11.3 Micro-copy française

- **Tutoiement** partout (« Tu », « Ta »)
- **Chiffres** en français avec espace insécable : `3 214 cartes`
- **Dates** relatives (« il y a 2 h ») pour l'actualité, absolues pour l'historique

---

## 12. Do & Don't

### ✅ DO

- Aligner tout sur la grille 8
- Utiliser CyberButton pour toute action primaire
- Réserver le glitch à UN CTA principal par écran
- Passer `cutColor` sur les CyberButton mobile hors `--bg`
- Utiliser les halos rareté sur toutes les cartes
- Respecter `prefers-reduced-motion`
- Utiliser tabular-nums pour les chiffres qui comptent

### ❌ DON'T

- Emojis dans l'UI (⚠️ ok en confirmation, ❤️ ok pour like, mais jamais en icône)
- Ombres douces `box-shadow` type "elevation Material"
- Border-radius > 10 px (on est angulaire)
- Faux italique sur Orbitron / Rajdhani
- Deux boutons glitch sur le même écran
- Animation en boucle infinie qui fait bouger du contenu textuel
- Illustration stock (Unsplash card, Undraw) — tout est custom
- Réutiliser un asset officiel Konami (copyright)
- Icône emoji dans une tab bar (🃏📚 sont bannis)

---

## 13. Guide d'implémentation web

### 13.1 Ordre de refonte des composants

1. **Étendre `src/styles/theme.css`** avec les nouveaux tokens (motion, spacing, rarity halos)
2. **Créer `src/components/decor/`** :
   - `Glyphs.tsx` — bibliothèque de SVG glyphes (eye, ankh, pyramid, scarab, lotus)
   - `ParallaxLayer.tsx` — wrapper qui applique le transform depuis un contexte
   - `CornerOrnaments.tsx` — les 4 coins fixés
   - `GrainOverlay.tsx` — overlay fixed avec grain animé
   - `RarityHalo.tsx` — HOC / util pour appliquer la classe halo
3. **Créer `src/components/ui/`** additions :
   - `StatsBar.tsx`
   - `CyberPanel.tsx`
   - `Chip.tsx`
   - `HeroTitle.tsx` (avec le sous-titre arcane optionnel)
   - `CardTile.tsx` (à extraire de Collection.tsx)
4. **Refactor pages** dans cet ordre :
   1. `Collection.tsx` (page phare)
   2. `Home.tsx` (à créer si inexistant)
   3. `Login.tsx`, `Register.tsx`
   4. `Decks.tsx`, `DeckView.tsx`, `DeckEditor.tsx`
   5. `Profile.tsx`, `UserProfile.tsx`, `Social.tsx`, `Followers.tsx`
   6. `Admin.tsx` (peut rester sobre — tableau)

### 13.2 Structure attendue d'une page

```tsx
import { Layout } from '@/layouts/AppLayout'; // navbar + corners + parallax + grain
import { HeroTitle, StatsBar, Chip, CardTile } from '@/components/ui';

export default function Collection() {
  return (
    <Layout>
      <HeroTitle
        arcane="— Vitrine du Millénium —"
        title="Ma Collection"
        sub="3 214 cartes rassemblées."
      />
      <StatsBar stats={[...]} />
      <ActionBar />  {/* search + Ajouter + Filtres */}
      <FilterRow chips={[...]} />
      <CardsGrid>
        {cards.map((card, i) => <CardTile key={card.id} card={card} index={i} />)}
      </CardsGrid>
    </Layout>
  );
}
```

### 13.3 Perf

- Lazy-load des images de cartes (`loading="lazy"`)
- Virtualisation de la grille si > 200 cartes (`react-window` OK, léger)
- `will-change: transform` sur les tuiles hover (pas sur toutes en permanence)
- Précharger les fonts en `preload` dans `index.html`

---

## 14. Guide d'implémentation mobile

### 14.1 Contraintes rappelées

- **Pas de `react-native-svg`** — les glyphes complexes sont des PNG rendus depuis SVG à la CI
- **Pas de `clip-path`** — les biseaux sont simulés par des `View` pivotées de la couleur du fond
- **Pas de `react-native-skia`** — trop lourd

### 14.2 Composants mobile à créer

1. `mobile/src/components/decor/Glyphs.tsx` — glyphes en `View + border` (triangle
   pour pyramide, cercle+ellipse pour œil, etc.)
2. `mobile/src/components/decor/CornerOrnaments.tsx` — les 4 coins en `View`
3. `mobile/src/components/CardTileMobile.tsx` — équivalent RN de CardTile
4. `mobile/src/components/HeroTitle.tsx` — titre avec ornement Cormorant
5. `mobile/src/components/BottomTabBar.tsx` — tab bar custom avec icônes vraies

### 14.3 Icônes tabs — action prioritaire

**Sortir immédiatement les emojis** de `_layout.tsx` :

Créer un composant `TabIcon` qui prend `name: 'collection' | 'decks' | 'social' | 'profile'`
et rend un SVG via `expo-image` (qui supporte SVG en source URI) OU un PNG rendu depuis
`docs/BRIEF-REFONTE-V2.md` §4.3 via le script `scratchpad/gen.js`.

### 14.4 Animation via Reanimated

`react-native-reanimated` est déjà installé (voir `package.json`). Utiliser pour :
- Fade + slide entrée de page (via `useSharedValue` + `withTiming`)
- Halo pulse sur cartes Ultra/Secret
- FAB pulse

**Pas de parallax mouse-move sur mobile** — pas de curseur. Parallax = scroll uniquement.

---

## 15. Checklist de validation

Avant de merger une refonte de page, vérifier :

- [ ] Tokens utilisés uniquement (pas de couleur hex en dur)
- [ ] Pas d'emoji dans l'UI structurelle
- [ ] Un seul CyberButton `glitch` sur l'écran
- [ ] `cutColor` passé aux CyberButton mobile hors `--bg`
- [ ] Cards avec halo rareté approprié
- [ ] Prefers-reduced-motion respecté (toutes les animations ont leur garde)
- [ ] Contraste texte ≥ 4.5:1 en dark et en light
- [ ] Focus visible sur tous les interactifs
- [ ] Responsive testé à 375 / 720 / 1200 / 1600 px
- [ ] Chiffres en tabular-nums
- [ ] Icônes uniquement du catalogue `Icons.tsx` (jamais d'emoji, jamais d'icône
      externe non validée)
- [ ] Layout aligné sur grille 8

---

## Ressources

- Maquettes de référence : `docs/claude-design-package/maquettes-v2/` (15 fichiers HTML)
- Brief produit : `docs/BRIEF-REFONTE-V2.md`
- Package Claude Design : `docs/claude-design-package/` (à donner tel quel à un designer)
- Code existant : `client/src/styles/theme.css`, `mobile/src/theme/palette.ts`, `client/src/components/ui/Button.tsx`, `mobile/src/components/CyberButton.tsx`
