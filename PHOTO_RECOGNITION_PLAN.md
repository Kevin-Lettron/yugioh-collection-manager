# 📸 Reconnaissance de cartes par photo — Plan d'action

> Document de référence pour l'implémentation de la fonctionnalité "scanner une carte Yu-Gi-Oh avec la caméra pour l'ajouter automatiquement à la collection".

## 🎯 Objectif utilisateur

Permettre à l'user de :
1. Prendre en photo une carte Yu-Gi-Oh (via caméra ou upload).
2. Optionnellement ajouter une description texte (ex : *« relief doré sur le dragon, logo ULTRA en bas à droite »*).
3. Laisser l'app identifier automatiquement le **code de la carte** (format `XXX-XXNNN`) et son **nom**.
4. Choisir la **rareté** parmi celles réellement possibles pour ce code (dropdown pré-filtré).
5. Ajouter la carte à la collection en 1 clic.

---

## 🏗️ Architecture choisie

### Stack

| Brique | Outil | Pourquoi |
|---|---|---|
| Vision / OCR | **Claude Vision** (`claude-haiku-4-5`) via SDK Anthropic | Déjà intégré pour le deck builder IA. Haiku est 5× moins cher que Sonnet et largement suffisant pour extraire un code carte. |
| Validation | **YGOProDeck API** | Déjà intégré. Valide que le code existe et retourne les raretés réelles. |
| Stockage photo | **Aucun** (éphémère) | La photo transite en mémoire, elle est envoyée à Claude puis jetée. Zéro coût, zéro RGPD. |
| Rate limiting | Compteur en mémoire par user | Même mécanique que le deck builder (`CLAUDE_API_MAX_CALLS`). |

### Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Frontend : CardScanner                                │
│    - <input capture="environment"> ou getUserMedia       │
│    - Canvas → compress JPEG 1024px largeur max (~200 Ko) │
│    - Champ texte optionnel "Description"                 │
│    - POST /api/collection/scan { image, description }    │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Backend : cardScanService.scanCard()                  │
│    - Check rate limit (CLAUDE_SCAN_MAX_CALLS)            │
│    - Claude Vision (haiku-4-5, image + prompt FR)        │
│    - Prompt : "Retourne JSON {code, name, confidence}"   │
│    - Parse + valide format code (regex XXX-XXNNN)        │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 3. Backend : ygoprodeckService.getCardByCode()           │
│    - Valide l'existence du code                          │
│    - Récupère {name, desc, image, card_sets[]}           │
│    - card_sets[] contient les raretés possibles          │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 4. Response : {                                          │
│      code, name, officialImage,                          │
│      availableRarities: ["Common","Super Rare",...],     │
│      confidence: 0.92                                    │
│    }                                                     │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 5. Frontend : CardScanConfirmation                       │
│    - Aperçu photo user ↔ image officielle côte à côte    │
│    - Dropdown raretés (pré-filtré)                       │
│    - Champ quantité (défaut 1)                           │
│    - Boutons "Ajouter" / "Pas la bonne carte"            │
│    - Sur "Ajouter" → réutilise /api/collection/add       │
└──────────────────────────────────────────────────────────┘
```

---

## 🔑 Clés API & variables d'environnement

| Variable | Où | Valeur | Statut |
|---|---|---|---|
| `CLAUDE_API_KEY` | `server/.env` | Clé Anthropic | ✅ déjà configurée (utilisée par le deck builder) |
| `CLAUDE_SCAN_MAX_CALLS` | `server/.env` | `30` | 🆕 à ajouter (compteur séparé du deck builder) |

**Aucune autre clé API n'est nécessaire.** YGOProDeck est publique et sans auth.

---

## 📁 Fichiers à créer / modifier

### Backend
```
server/src/services/cardScanService.ts         [NEW]
    → Appel Claude Vision + parsing + validation YGOProDeck
    → Fonctions : scanCard(imageBase64, description?) → { code, name, ... }
    → Export : getScanCallCount(), getMaxScanCalls(), getRemainingScanCalls()

server/src/controllers/collectionController.ts [EDIT]
    → + scanCard(req, res)  — endpoint principal
    → + getScanStatus(req, res)  — retourne le quota restant

server/src/routes/collectionRoutes.ts          [EDIT]
    → + POST /api/collection/scan
    → + GET  /api/collection/scan/status

server/src/middleware/uploadMiddleware.ts      [EDIT]
    → + middleware memoryStorage pour JPEG/PNG, limite 2 Mo

server/.env.example                            [EDIT]
    → + CLAUDE_SCAN_MAX_CALLS=30
```

### Frontend
```
client/src/components/CardScanner.tsx          [NEW]
    → Capture caméra + compression canvas + preview + envoi

client/src/components/CardScanConfirmation.tsx [NEW]
    → Écran "carte détectée", dropdown rareté, boutons

client/src/pages/Collection.tsx                [EDIT]
    → Bouton "📷 Scanner une carte" qui ouvre CardScanner

client/src/services/api.ts                     [EDIT]
    → + scanCard(imageBase64, description?)
    → + getScanStatus()
```

---

## 🛡️ Garde-fous

- **Taille image** : rejet serveur si > 2 Mo. Compression côté client à ~200 Ko avant envoi.
- **Rate limit** : `CLAUDE_SCAN_MAX_CALLS` par user. Compteur en mémoire (compatible avec restart, on part de zéro à chaque redémarrage backend — simple et OK pour MVP).
- **Fallback** : si Claude ne détecte rien ou si YGOProDeck renvoie 404 → UI propose saisie manuelle (on ne casse pas le flow existant).
- **Confidence score** : si Claude retourne une confiance < 0.7, afficher un warning dans l'UI (*« On n'est pas sûr, vérifie bien »*).
- **Logs** : logger les scans ratés dans `server/logs/` (code non reconnu, code invalide, YGOProDeck 404) pour affiner le prompt plus tard.
- **Erreurs réseau** : retry automatique 1 fois sur les 5xx, message user clair sur les 4xx.

---

## 🎨 UX — points clés

- **Bouton caméra visible** sur la page Collection, à côté de l'input "Ajouter par code".
- **Mode PWA** : sur mobile installé, la capture caméra doit fonctionner nativement (iOS ≥ 14, Android moderne). `<input type="file" accept="image/*" capture="environment">` suffit — pas besoin de `getUserMedia` pour la v1.
- **Loader clair** pendant l'appel Claude (1-3 s typiquement) — éviter la sensation de figé.
- **Écran de confirmation obligatoire** avant ajout : aperçu photo user + image officielle côte à côte. Si mismatch visible, user peut annuler.
- **Bouton "Ce n'est pas la bonne carte"** → réouvre le CardScanner avec un état "J'aide l'IA" qui force la description texte.

---

## 💰 Estimation coûts

Avec **claude-haiku-4-5** + image 1024 px compressée :
- ~300-500 tokens input (image + prompt système)
- ~100 tokens output (JSON court)
- **≈ 0,2 à 0,4 ¢ par scan**

| Volume | Coût mensuel |
|---|---|
| 100 scans/mois | < 0,50 € |
| 1 000 scans/mois | 2-4 € |
| 10 000 scans/mois | 20-40 € |

Le rate limit `CLAUDE_SCAN_MAX_CALLS=30` par user/reset évite toute dérive.

---

## 📅 Découpage en tâches

| # | Tâche | Effort |
|---|---|---|
| 1 | `cardScanService.ts` + prompt système + tests unitaires mockés | 2 h |
| 2 | Endpoint `/api/collection/scan` + middleware memory upload + rate limit | 1 h |
| 3 | Composant `CardScanner.tsx` (capture + compression + preview) | 2 h |
| 4 | Composant `CardScanConfirmation.tsx` (dropdown rareté + validation) | 1,5 h |
| 5 | Intégration dans `Collection.tsx` + extension `api.ts` | 30 min |
| 6 | Tests manuels (plusieurs cartes + conditions d'éclairage réelles) | 1 h |
| **Total** | | **~8 h** |

---

## 🤔 Décisions en suspens

- [ ] **Stockage photos** : confirmer qu'on n'en garde aucune (approche éphémère). Si besoin de logs de scan ratés, stocker uniquement les photos marquées "mauvaise carte" pendant 7 jours pour analyse ?
- [ ] **Scan batch** : v1 = 1 carte à la fois. v2 possible : scan rapide de plusieurs cartes étalées ? (plus complexe, à voir selon usage).
- [ ] **Détection de contrefaçon / cartes anglaises vs françaises** : à déléguer à l'user pour la v1 (il choisit la langue dans la rareté). v2 peut s'en occuper si besoin.

---

## 📝 Prompt système Claude (brouillon)

À affiner lors du développement :

```
Tu es un expert Yu-Gi-Oh chargé d'identifier des cartes à partir de photos.

L'utilisateur t'envoie une photo d'une carte (éventuellement avec une description
complémentaire). Ta tâche : extraire UNIQUEMENT le code de la carte, visible
en général en bas à gauche ou en bas à droite de la carte.

Format attendu du code : XXX-XXNNN (ex: LDK2-FRK01, LOB-EN001)
- 2 à 5 lettres, un tiret, 2 à 5 lettres, 1 à 3 chiffres
- Les 2 lettres au milieu indiquent la langue (EN, FR, DE, IT, SP, PT, JP, KR)

Retourne STRICTEMENT un JSON valide, rien d'autre :
{
  "code": "LDK2-FRK01",
  "name": "Nom français lu sur la carte (ou null si illisible)",
  "confidence": 0.0 à 1.0,
  "notes": "éventuelles ambiguïtés ou zones floues"
}

Si tu ne peux pas lire le code avec certitude, retourne "code": null et
explique pourquoi dans "notes".
```

---

**Dernière mise à jour** : 2026-04-21
