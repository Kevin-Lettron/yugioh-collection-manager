# Suivi de la refonte esthétique — Cyberpunk / Yu-Gi-Oh

> Fichier de passation. Il est mis à jour et poussé à **chaque étape** pour pouvoir
> reprendre le travail depuis une autre machine sans rien perdre du contexte.

**Dernière mise à jour :** 2026-07-31 — étape 3 terminée (composants ui/)

---

## 1. Décisions actées

| Sujet | Décision |
|---|---|
| Périmètre | Web (`client/`) **et** mobile (`mobile/`), design system partagé |
| Thème | Sombre par défaut **+ bascule claire**, préférence mémorisée |
| Palette | **Or / Violet** — or du Millénium dominant, violet en secondaire |
| Boutons | Inspirés de [Kevin-Lettron/Cyberpunk](https://github.com/Kevin-Lettron/Cyberpunk) : coins biseautés, ombre décalée, glitch au survol — couleurs changées |
| Assets Yu-Gi-Oh | **Motifs SVG originaux** dessinés pour le projet (pyramide inversée, œil stylisé, trame de circuit). Aucun asset officiel Konami n'est repris — c'est du copyright. |

## 2. Palette

### Sombre (défaut)

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#0B0906` | Fond de page |
| `--bg-elev` | `#14100A` | Barres, en-têtes |
| `--panel` | `#1A1510` | Cartes, panneaux |
| `--panel-2` | `#221B12` | Panneau imbriqué, survol |
| `--border` | `#3A2E1C` | Bordures |
| `--text` | `#F5EFE0` | Texte principal |
| `--text-muted` | `#A99C86` | Texte secondaire |
| `--gold` | `#F5C518` | **Primaire** — CTA, focus, accents |
| `--violet` | `#A855F7` | **Secondaire** — ombre décalée, liens |
| `--cyan` | `#22D3EE` | Accent, infos |
| `--magenta` | `#FF2E88` | Alertes fortes |
| `--success` | `#34D399` | Succès |
| `--danger` | `#FF4D6D` | Erreur, destructif |

### Clair

Même rôles, valeurs adaptées au contraste : fond `#F7F3EA`, panneaux `#FFFFFF`,
texte `#1A1206`, or assombri à `#8A6D0B` (l'or néon est illisible sur fond clair).

## 3. Architecture technique

### Web (`client/`)

- Tokens en variables CSS dans `src/styles/theme.css` — `:root` = sombre, `[data-theme='light']` = clair.
- **`tailwind.config.js` remappe les couleurs existantes vers ces variables** :
  `gray-*` inversé, `blue-*` → or, `white` → surface. Les ~900 classes de couleur
  déjà écrites dans les pages deviennent thémables sans toucher au JSX ligne à ligne.
- `src/context/ThemeContext.tsx` : état + `localStorage` + attribut `data-theme` sur `<html>`.
- Boutons : classes `.cyber-btn` dans `theme.css`, consommées par `components/ui/Button.tsx`.
- Motifs : `src/components/decor/` (composants SVG React).

### Mobile (`mobile/`)

- `src/theme/palette.ts` : mêmes tokens, en objet TS.
- `src/theme/ThemeContext.tsx` : provider + persistance.
- `src/theme/useThemedStyles.ts` : `makeStyles(theme)` mémoïsé.
- `src/components/CyberButton.tsx` : `clip-path` n'existe pas en React Native.
  Les coins biseautés sont obtenus par des carrés pivotés à 45° de la couleur du fond,
  posés sur les angles, + une couche d'ombre décalée derrière. **Aucune dépendance ajoutée.**

## 4. Avancement

- [x] **Étape 0** — Fichier de suivi + **charte graphique** autonome (`docs/maquette-cyberpunk.html`)
      — logo et ses variantes, rôle de chaque couleur avec répartition 60/30/10, échelle
      typographique, jeu d'icônes maison, anatomie des composants, do & don't, maquette d'écrans.
- [x] **Étape 1** — Web : tokens CSS + remap Tailwind
      - `client/src/styles/theme.css` : les deux jeux de tokens + classes `.cyber-*`
      - `client/tailwind.config.js` : les familles Tailwind pointent vers les variables
      - Polices **auto-hébergées** (`@fontsource/orbitron`, `@fontsource/rajdhani`) : la CSP du
        site n'autorise que `font-src 'self'`, Google Fonts serait bloqué
      - `index.html` : `theme-color` passé à `#0b0906`
- [x] **Étape 2** — Web : ThemeContext + bascule
      - `src/context/ThemeContext.tsx` : lecture de la préférence **au premier rendu** (pas dans un
        effet) pour éviter le flash de thème clair ; suit `prefers-color-scheme` tant que
        l'utilisateur n'a rien choisi ; met à jour `theme-color` pour la barre d'état mobile
      - `src/components/ThemeToggle.tsx` dans la navbar
      - `App.tsx` : `ThemeProvider` en racine + toasts aux couleurs du thème
- [x] **Étape 3** — Web : bouton cyber + composants `ui/`
      - `Button` consomme `.cyber-btn` : variantes primaire (or) / secondaire (violet) /
        danger / fantôme, props `glitch` (réservé à l'action principale) et `tag`
      - `Card`, `Modal` → biseaux `cyber-tile` ; `Input`, `Select` → liseré d'accent à gauche,
        angles droits ; `Badge` → coins coupés au lieu de la pilule
      - `Button` et `Input` reçoivent un `type` par défaut (`button` / `text`) : deux tests
        l'exigeaient déjà et échouaient avant cette refonte
- [x] **Étape 4** — Web : motifs SVG Yu-Gi-Oh (`src/components/decor/Icons.tsx`)
      — marque du Millénium, carte, deck, scan, social, recherche, filtres, ajout, alerte, validé,
      lune, soleil. Toutes en `currentColor`, grille 24, angles vifs.
- [ ] **Étape 5** — Web : navbar + 12 pages
- [ ] **Étape 6** — Mobile : palette + ThemeContext + hook
- [ ] **Étape 7** — Mobile : CyberButton + composants partagés
- [ ] **Étape 8** — Mobile : 16 écrans et modales
- [x] **Étape 9** — Tests `ui/` web mis à jour (faite en même temps que l'étape 3)
- [ ] **Étape 10** — Typecheck + tests + build de vérification

## 5. Points de vigilance

- **`client/src/__tests__/components/ui/*.test.tsx` assertent les classes Tailwind exactes**
  (`bg-blue-600`, `bg-gray-200`, `text-gray-700`…). Ils casseront à l'étape 3 et devront
  être mis à jour dans la même passe — c'est attendu, ils encodent l'ancien design.
- Le remap Tailwind inverse l'échelle de gris en sombre : `bg-gray-50` (surface la plus
  claire en clair) devient la surface la **plus sombre**. À vérifier écran par écran.
- `bg-black` est conservé littéral : il sert aux fonds de caméra (scanner), pas au thème.
- Mobile : pas de police custom (nécessiterait `expo-font` + fichiers). Le style « cyber »
  passe par les majuscules, le `letterSpacing` et les biseaux.
- Chaque étape terminée = commit + push, avec ce fichier mis à jour.
- **La suite de tests web était déjà largement rouge avant la refonte** : 197 échecs sur 456 au
  commit de départ (mocks d'API manquants sur les tests de pages, doublons de libellés dans
  `Toggle`, sélecteur `closest('div')` dans `Modal`). Après l'étape 3 : **195 échecs** — les
  seuls tests que la refonte a invalidés ont été mis à jour, et deux échecs préexistants sont
  corrigés au passage. Ces 195 restants sont hors périmètre de la refonte.

## 6. Comment reprendre ailleurs

```bash
git clone https://github.com/Kevin-Lettron/yugioh-collection-manager
cd yugioh-collection-manager
cat SUIVI-REFONTE.md          # cet état des lieux
open docs/maquette-cyberpunk.html   # la direction visuelle validée
```

Puis reprendre à la première case non cochée de la section 4.
