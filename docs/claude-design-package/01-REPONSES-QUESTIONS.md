# Réponses aux questions préliminaires

Ces réponses cadrent le premier round pour Claude Design. À copier tel quel dans
la conversation pour débloquer.

---

## 1. Puis-je récupérer le code existant ?

**Réponse : « Je colle les fichiers clés dans le chat. »**

Ils sont dans `code-existant/`. Le brief y fait référence par nom :

- `theme.css` — tokens CSS web (`:root` = dark, `[data-theme='light']` = light, la classe
  `.cyber-btn` complète, la trame de fond, les motifs)
- `palette.ts` — les mêmes tokens en TypeScript pour le mobile (React Native)
- `Button.tsx` — composant bouton web (importe `.cyber-btn` de `theme.css`)
- `CyberButton.tsx` — équivalent mobile (biseau simulé par carré pivoté, pas de
  `clip-path` en RN)
- `CyberSurfaces.tsx` — panels, tiles, badges mobile + le composant `MillenniumMark`
  (triangle dessiné par bordures pour éviter `react-native-svg`)
- `Icons.tsx` — jeu d'icônes SVG maison du web (grille 24, trait 1.6, angles vifs)

Colle ces 6 fichiers dans le chat après le brief.

---

## 2. Ce que je veux voir en premier

**Réponse : « 3-4 directions appliquées au MÊME écran (Collection), pour comparer à iso-contenu. »**

Justification : la Collection est vue 90 % du temps par un utilisateur. C'est l'écran
de vérité. Si une direction ne fonctionne pas dessus, elle est disqualifiée pour tout
le reste. Le comparatif iso-contenu neutralise le biais « le hero de la Home fait plus
d'effet parce qu'il a une baseline ».

Une fois LA direction choisie, tu déclines sur les 7 autres écrans.

---

## 3. Écrans à maquetter dans ce premier round

**Réponse : cocher UNIQUEMENT `Collection` pour ce premier round.**

3-4 directions × 1 écran = déjà 3-4 maquettes à comparer sérieusement. Multiplier
par 8 écrans = 24-32 maquettes, personne ne peut choisir dans ce volume.

Les 7 autres écrans (Home, DeckView, DeckEditor, Social, Profile, Login, Scan mobile)
viennent APRÈS le choix de direction, en second round.

---

## 4. À quel point les directions doivent diverger ?

**Réponse : « Divergence forte — ambiances vraiment différentes (temple / espace / club underground / codex) »**

Justification : la palette or+violet et le CyberButton sont fixes, mais le RESTE
doit varier assez pour que le choix soit tranché. Trois variations sur le même
motif de décor apportent zéro signal — trois univers distincts oui.

Concrètement, propose au moins 3 directions parmi :

- **Sanctuaire arcane** (temple égyptien × cyberpunk) — celle recommandée dans le brief
- **Deep space** (nébuleuses violettes, cartes en lévitation, portails)
- **Salle de duel underground** (club nocturne, néons, béton, métal)
- **Codex vivant** (grimoire, runes, filigrane, encre, pages qui tournent)

Chaque direction a une identité que je peux résumer en un mot.

---

## 5. Où mettre l'énergie (2-3 max)

**Réponse : cocher `Traitement des cartes`, `Décoration structurelle`, `Iconographie custom (dont les tabs mobile)`**

Justification :

- **Traitement des cartes** — c'est le vrai contenu du produit. Actuellement chaque
  carte est un thumbnail plat. La direction visuelle doit se manifester en priorité
  ici : halo par rareté, effet holographique, badges typés, hover 3D. Sans ça, la
  refonte reste cosmétique.

- **Décoration structurelle** — bordures de cadre, séparateurs, coins d'écran,
  textures de fond, illustrations d'états vides. C'est ce qui différencie une app
  « propre mais banale » d'un univers.

- **Iconographie custom (tabs mobile)** — les emojis 🃏📚 actuels sont un scandale
  documenté dans le brief. Des icônes vectorielles cohérentes sont attendues **dès
  le premier round** — pas en round 2.

Motion + parallax + Layout + Copywriting FR sont importants aussi mais viennent en
second round une fois la direction validée. Sinon on éparpille.

---

## Format des livrables attendus pour ce premier round

Après ces réponses, ce que Claude Design doit livrer :

1. **1 moodboard par direction** — 6-12 images de référence + palette annotée + typo
   + 3 mots-clés d'ambiance. Format Figma ou HTML statique.
2. **1 maquette Collection par direction** — hi-fi, format HTML statique autonome (comme
   `maquettes-v2/collection-web.html`) OU Figma exportable.
3. **1 planche iconographie custom par direction** — les 4 icônes de la bottom tab bar
   mobile (Collection, Decks, Social, Profile) + éventuellement 2-3 illustrations d'états
   vides. SVG.
4. **1 tableau comparatif** — synthèse en une page : pour chaque direction, forces,
   faiblesses, coût d'implémentation, cible utilisateur qui vibrerait le plus.

Timeline : 2-3 jours pour ce premier round.

Après validation d'UNE direction par nous, second round : les 7 autres écrans + design
system étendu + prototype animé.
