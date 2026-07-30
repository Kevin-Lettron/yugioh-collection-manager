# YuGiOh Collection — Mobile

App React Native / Expo. Tape le même backend que `client/` (https://keitland.eu par défaut).

Voir `PLAN.md` pour la roadmap de portage complète.

## État actuel

- Setup Expo SDK 57 + Expo Router + TypeScript strict
- Client HTTP axios avec JWT stocké dans `expo-secure-store`
- `AuthContext` avec login / register / logout / auth guard
- Écran Login + Register
- Placeholder Collection avec bouton logout
- À venir : Collection, scan caméra, Decks, Social, Profile, Admin

## Comment tester (sans installer quoi que ce soit sur ton poste)

### Étape 1 — Installer Expo Go sur ton téléphone

- Android : Play Store → chercher "Expo Go" → installer (gratuit)
- iOS : App Store → même chose

### Étape 2 — Lancer le serveur de dev

Sur ton PC, dans un terminal :

```powershell
cd C:\laragon\www\New-YugiohCollection\mobile
npx expo start
```

Un QR code s'affiche.

### Étape 3 — Scanner le QR code

- Android : ouvre Expo Go → onglet "Scan QR Code" → vise le QR affiché
- iOS : ouvre l'app Appareil Photo → vise le QR → clic sur la notif Expo Go

L'app se charge sur ton téléphone en 10-20 s.

Modifications live : dès que tu (ou moi) modifies un fichier, l'app se recharge automatiquement sur le tel.

### Prérequis réseau

- Ton PC et ton téléphone doivent être sur le même Wi-Fi
- Si ça bloque (firewall / réseau public / réseau d'entreprise) : lancer avec `npx expo start --tunnel` — plus lent, mais marche à travers n'importe quel réseau

## Configuration

Par défaut, l'app tape la prod `https://keitland.eu/api`.

Pour override vers un serveur local, crée un fichier `.env` :

```
EXPO_PUBLIC_API_URL=http://192.168.1.42:3000
```

(Remplace par l'IP de ton PC sur ton réseau local.)

## Structure

```
src/
├── app/                        # Routes (file-based, Expo Router)
│   ├── _layout.tsx             # Root : AuthProvider + auth guard
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (tabs)/
│       ├── _layout.tsx         # Bottom tabs
│       └── index.tsx           # Collection (placeholder)
├── config.ts                   # API_URL
├── context/AuthContext.tsx
└── services/api.ts             # axios + intercepteur JWT
```

## Génération APK (plus tard)

Voir `PLAN.md` section "Génération APK".
