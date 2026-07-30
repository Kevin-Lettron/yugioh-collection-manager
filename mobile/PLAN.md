# YugiOh Collection — Mobile App (React Native / Expo)

Version native Android/iOS de l'app web `client/`. Même backend Node.js (`server/`), même API REST, même auth JWT.

## Pourquoi une app native ?

Le principal blocage : sur Android, l'appel à la caméra depuis la PWA tue l'onglet Chrome (bug OEM Samsung). Une app native accède à la caméra sans jamais perdre le contexte via `expo-camera`.

## Stack

- **Expo SDK (managed workflow)** — pas d'Android Studio requis, build cloud via EAS
- **Expo Router** — routing file-based (similaire à Next.js), remplace React Router
- **NativeWind** — Tailwind CSS pour React Native, ~80% des classes web réutilisables
- **TypeScript** — strict, partagé avec `shared/types/`
- **axios + expo-secure-store** — client HTTP + storage JWT sécurisé (remplace localStorage)
- **@tanstack/react-query** (à confirmer) — cache et sync des données serveur

## Structure repo

```
mobile/
├── app/                    # File-based routing (Expo Router)
│   ├── (auth)/             # Groupe : login, register
│   ├── (tabs)/             # Groupe : collection, decks, social, profile (bottom tabs)
│   ├── deck/[id].tsx       # DeckView dynamique
│   ├── deck/edit/[id].tsx  # DeckEditor
│   ├── admin/              # Admin panel (dashboard, users, decks, comments)
│   └── _layout.tsx         # Root layout : AuthProvider, providers
├── src/
│   ├── components/         # UI components partagés
│   ├── services/api.ts     # Axios client + endpoints
│   ├── context/            # AuthContext, NotificationContext
│   ├── hooks/              # useDebounce, useInfiniteScroll, etc.
│   └── utils/              # Helpers
├── assets/                 # Icônes, splash, fonts
├── app.json                # Config Expo (bundle ID, permissions caméra, etc.)
├── eas.json                # Config EAS Build (profils dev/preview/prod)
└── tsconfig.json           # Alias vers ../shared/types
```

`shared/types/` réutilisé tel quel (source unique de vérité types).

## Roadmap portage (ordre d'implémentation)

### Phase 1 — Fondations (jour 1) — FAIT
- [x] Init projet Expo SDK 57 + TypeScript + Expo Router
- [x] ~~NativeWind~~ — décidé : StyleSheet natif (safer pour SDK 57)
- [x] Setup api client (axios + intercepteur JWT depuis expo-secure-store)
- [x] AuthContext + persistence session + auto-logout sur 401
- [x] Root layout : AuthProvider + auth guard (redirect (auth)↔(tabs))
- [x] app.json : nom app, bundle ID, permissions caméra + photos

### Phase 2 — Auth (jour 2) — FAIT
- [x] Screen Login `app/(auth)/login.tsx` (email OU username + password)
- [x] Screen Register `app/(auth)/register.tsx` avec validation policy
- [x] Redirection auto selon état auth (via useSegments)

### Phase 3 — Collection + Scan caméra (jour 3-4) — FAIT ← LE use case #1
- [x] Screen Collection `app/(tabs)/index.tsx` : FlatList grid 2 cols, search debounced, pagination infinie, pull-to-refresh
- [x] Modal ajout carte manuel `AddCardModal.tsx` : recherche par code, preview, chips rareté/langue, quantité
- [x] Modal détail carte `CardDetailModal.tsx` : image full, chips type/attribut/race, stats, description, infos collection, retirer
- [x] **Scan caméra native** `app/scan.tsx` via `expo-camera` — flow camera → preview → analyze → confirm/noresult
- [x] Confirmation scan avec formulaire pré-rempli (set, rareté détectée, langue détectée, quantité) + ajout collection
- [x] Types locaux `src/types.ts` (miroir de `shared/types/`) + service `src/services/collectionApi.ts` + hook `useDebounce`

### Phase 3.5 — Compléter la Collection (parité ISO web) — FAIT
- [x] Filtres avancés type/attribut/rareté via `FiltersModal.tsx` (chips scrollable, bouton reset, badge count sur bouton Filtres, chips actifs affichés au-dessus de la liste)
- [x] Édition quantité inline (+/-) sur chaque card de la liste avec optimistic update + rollback en cas d'erreur ; passage à 0 = confirmation retrait
- [x] Dropdown des sets disponibles dans `AddCardModal.tsx` (liste cliquable avec set_code + set_name + rareté, pré-remplit set + rareté au tap)
- [x] Détail carte enrichi `CardDetailModal.tsx` :
  - Attribut coloré par élément (DARK gris, LIGHT jaune, FIRE rouge, WATER bleu, EARTH beige, WIND vert, DIVINE doré) + label FR
  - Link markers ("Flèches Lien : Top-Left, ...")
  - Archetype
  - Banlist TCG / OCG chips colorés selon statut
  - Pendulum scale
  - Stats ATK/DEF colorés (rouge / bleu)

Collection = 100% ISO web. Prochaine phase autorisée : Decks.

### Phase 4 — Decks (jour 5-8)
- [ ] Liste decks `app/(tabs)/decks.tsx`
- [ ] Détail deck `app/deck/[id].tsx` : main/extra deck, likes, commentaires
- [ ] Editor deck `app/deck/edit/[id].tsx` : DnD cartes, validation, banlist
- [ ] AI Deck Builder (Claude API)
- [ ] Partage lien deck (deep link `/deck/share/:token`)

### Phase 5 — Social (jour 9-10)
- [ ] Feed social `app/(tabs)/social.tsx`
- [ ] Profile user `app/user/[id].tsx`
- [ ] Followers / Following
- [ ] Notifications (badge sur bottom tab)

### Phase 6 — Profile perso (jour 11)
- [ ] Screen Profile `app/(tabs)/profile.tsx` : édition username, email, photo profil
- [ ] Upload photo via `expo-image-picker`

### Phase 7 — Admin panel (jour 12-14)
- [ ] Dashboard stats
- [ ] Users management (liste, role, disable, delete)
- [ ] Decks management
- [ ] Comments moderation
- Note : UX mobile pour tables/gestion = moins pertinent, mais on porte pour parité complète

### Phase 8 — Polish + APK (jour 15+)
- [ ] Icônes app + splash screen (adapter le branding YGO)
- [ ] Permissions Android (`app.json` : caméra, stockage, notifications)
- [ ] Deep linking (partage decks)
- [ ] EAS Build → APK signé pour test interne
- [ ] Test sur device réel via Expo Go pendant tout le dev

## Backend : rien à changer

L'API `server/` expose déjà tout ce qu'il faut :
- Auth JWT (login, register, /me)
- Collection CRUD + scan Claude Vision
- Decks CRUD + partage + AI builder
- Social (follow, feed, comments)
- Admin

Seul ajout côté serveur si besoin plus tard :
- **CORS** : autoriser `exp://` schemes en dev (peut-être pas nécessaire, Expo proxifie)
- **Deep links** : rien de spécial, le partage passe par HTTPS keitland.eu

## Test pendant le dev (sans APK)

1. Installer **Expo Go** sur ton Android (gratuit, Play Store)
2. Depuis `mobile/` : `npx expo start`
3. Scanner le QR code affiché avec Expo Go → l'app tourne sur ton tel avec hot reload

Zéro build, zéro compte, zéro APK. Idéal pour tout le dev.

## Génération APK (plus tard, quand app prête)

1. Créer compte gratuit sur expo.dev
2. `npm install -g eas-cli` (une fois)
3. `eas login` puis `eas build --profile preview --platform android`
4. Attendre ~10-15 min → lien téléchargement APK
5. Envoyer APK sur tel Android (email/USB) → activer "Sources inconnues" → installer

Compte Google Play (25 $ à vie) reste optionnel — utile uniquement pour publier sur le Store.

## Suivi

Coche les cases au fur et à mesure ; ce fichier reste la source de vérité de l'avancement mobile.
