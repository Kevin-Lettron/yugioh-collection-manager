# Package pour Claude Design

Contient tout ce dont un designer (agent ou humain) a besoin pour reprendre la
refonte v2 « Sanctuaire du Millénium » sans avoir accès au repo complet.

## Contenu

```
claude-design-package/
├── README.md                         ← ce fichier
├── 00-BRIEF.md                       ← brief complet (à lire en premier)
├── 01-REPONSES-QUESTIONS.md          ← nos réponses aux questions préliminaires
├── code-existant/                    ← les fichiers clés référencés par le brief
│   ├── theme.css                     – tokens CSS web (dark + light, .cyber-btn, motifs)
│   ├── palette.ts                    – tokens TypeScript mobile (miroir de theme.css)
│   ├── Button.tsx                    – composant bouton cyber web
│   ├── CyberButton.tsx               – équivalent mobile (biseau simulé sans clip-path)
│   ├── CyberSurfaces.tsx             – CyberPanel, CyberTile, MillenniumMark mobile
│   └── Icons.tsx                     – jeu d'icônes SVG maison
└── maquettes-v2/                     ← maquettes HTML autonomes du niveau attendu
    ├── collection-web.html           – LA référence de style à imiter
    └── [autres écrans arrivent]      – Home, DeckView, DeckEditor, etc. + mobile
```

## Ordre de lecture recommandé pour le designer

1. **`00-BRIEF.md`** — 5 min de lecture. Cadre : produit, utilisateur, positionnement,
   contraintes, direction recommandée « Sanctuaire du Millénium ».
2. **`maquettes-v2/collection-web.html`** — ouvre dans un navigateur. C'est le niveau
   de finition attendu (parallax, glyphes, halos rareté, ornements, grain, cyber
   buttons, effet holographique). Toute nouvelle maquette doit être au moins à ce niveau.
3. **`code-existant/theme.css` + `palette.ts`** — les tokens à réutiliser tels quels.
   Ne pas redéfinir les couleurs, ne pas rebrand le CyberButton, ne pas remplacer le logo.
4. **`code-existant/Button.tsx` + `CyberButton.tsx`** — pour comprendre ce qui existe
   déjà côté composants CTA. Ne PAS recoder ces composants — les intégrer.
5. **`code-existant/Icons.tsx`** — jeu d'icônes existant. Le designer peut proposer
   de nouvelles icônes dans le même style (grille 24, trait 1.6, angles vifs).
6. **`01-REPONSES-QUESTIONS.md`** — les réponses aux questions préliminaires que
   Claude Design a posées (récupération code, format de livraison, écrans du premier
   round, niveau de divergence, où mettre l'énergie).

## Ce que le designer NE DOIT PAS toucher

Ces choix sont fermés — ne pas les remettre en cause dans les propositions :

- Palette **or #F5C518 + violet #A855F7 en dark et light** (marque)
- Composants **CyberButton** (déjà utilisés partout, le style glitch est validé)
- Logo **Millennium Mark** (pyramide inversée + œil, déjà en icône d'app + favicon)
- **Sombre par défaut** (validé récemment par le user)

Cf. §13 du brief.

## Ce qui manque et qu'on veut

- Une **vraie identité visuelle** au-delà des couleurs (illustrations, décor, texture)
- **Motion** : parallax multi-couches, animations d'entrée, hover riches, transitions
- **Iconographie custom pour la bottom tab bar mobile** — actuellement des emojis 🃏📚,
  intolérable
- **Traitement des cartes YGO comme des œuvres**, pas des thumbnails

## Livrables attendus

Cf. §9 du brief : moodboards, design system étendu, maquettes hi-fi × 8 écrans,
prototype animé, doc de handoff avec assets exportés.
