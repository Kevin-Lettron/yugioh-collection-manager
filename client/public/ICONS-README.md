# Icônes PWA à fournir

Pour que l'installation PWA affiche une belle icône sur Android / iOS / Desktop, dépose dans ce dossier `public/` :

| Fichier | Taille | Notes |
|---|---|---|
| `pwa-192x192.png` | 192×192 | icône standard |
| `pwa-512x512.png` | 512×512 | icône HD |
| `pwa-maskable-512x512.png` | 512×512 | avec 20% de marge autour du logo (Android coupe les bords) |
| `apple-touch-icon.png` | 180×180 | écran d'accueil iOS |

## Comment les générer facilement

**Option 1 — outil en ligne (recommandé)** : dépose un PNG 1024×1024 sur [realfavicongenerator.net](https://realfavicongenerator.net) ou [pwabuilder.com/imageGenerator](https://www.pwabuilder.com/imageGenerator), récupère les fichiers PNG et mets-les ici.

**Option 2 — CLI** :
```bash
npx pwa-asset-generator ./mon-logo.png ./public --manifest ./public/manifest.webmanifest
```

**Option 3 — placeholder temporaire** : ignore cette étape pour l'instant. La PWA fonctionnera, l'icône sera juste manquante/laide dans le menu d'installation.

Le fichier `favicon.svg` déjà présent sert de fallback dans l'onglet navigateur.
