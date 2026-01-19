# 🎴 YuGiOh Collection Manager

Une application web SaaS complète pour gérer votre collection de cartes Yu-Gi-Oh, créer des decks et partager avec la communauté.

## 🌟 Fonctionnalités

### 📦 Gestion de Collection
- ✅ Ajout de cartes par code (ex: "LDK2-FRK01")
- ✅ Sélection de la rareté
- ✅ Quantités multiples
- ✅ Filtres avancés (type, rareté, niveau, ATK, DEF)
- ✅ Recherche par mot-clé
- ✅ Vue détaillée avec toutes les informations de la carte

### 🃏 Gestion de Decks
- ✅ Création/Édition/Suppression de decks
- ✅ Validation des règles Yu-Gi-Oh officiel les:
  - Main Deck: 40-60 cartes
  - Extra Deck: max 15 cartes
  - Max 3 copies par carte
- ✅ Option Banlist (TCG):
  - Forbidden: 0 copie
  - Limited: 1 copie
  - Semi-Limited: 2 copies
- ✅ Séparation Main Deck / Extra Deck
- ✅ Badge indicateur de respect de la banlist
- ✅ Image de couverture personnalisable
- ✅ Decks publics/privés

### 👥 Réseau Social
- ✅ Recherche d'utilisateurs
- ✅ Follow/Unfollow
- ✅ Vue des profils publics
- ✅ Like/Dislike sur les decks
- ✅ Système de commentaires avec threads (réponses)
- ✅ Copie de decks en wishlist
- ✅ Notifications temps réel (WebSocket)

## 🛠️ Stack Technique

### Backend
- **Runtime**: Node.js avec TypeScript
- **Framework**: Express.js
- **Base de données**: PostgreSQL
- **Authentification**: JWT (JSON Web Tokens)
- **WebSocket**: Socket.io (notifications temps réel)
- **API externe**: YGOProDeck API
- **Upload**: Multer (système de fichiers local)

### Frontend
- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **Styling**: TailwindCSS
- **HTTP**: Axios
- **WebSocket**: Socket.io Client
- **Routing**: React Router v6

### Shared
- **Types**: Types TypeScript partagés entre client et serveur

## 📋 Prérequis

- Node.js 18+ (LTS recommandé)
- PostgreSQL 14+
- npm ou yarn

## 🚀 Installation

### 1. Cloner le repository
```bash
git clone https://github.com/Kevin-Lettron/yugioh-collection-manager.git
cd yugioh-collection-manager
```

### 2. Configuration de la base de données

#### a. Créer la base de données PostgreSQL
```bash
# Se connecter à PostgreSQL
psql -U postgres

# Créer la base de données
CREATE DATABASE yugioh_collection;

# Se connecter à la base
\c yugioh_collection

# Exécuter le schéma SQL
\i server/src/config/database.sql
```

Ou en une ligne :
```bash
psql -U postgres -c "CREATE DATABASE yugioh_collection;"
psql -U postgres -d yugioh_collection -f server/src/config/database.sql
```

### 3. Configuration Backend

```bash
cd server

# Installer les dépendances
npm install

# Copier le fichier .env.example
cp .env.example .env

# Modifier .env avec vos paramètres
# Éditez le fichier .env et configurez :
# - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
# - JWT_SECRET (utilisez une clé sécurisée en production)
```

### 4. Configuration Frontend

```bash
cd ../client

# Installer les dépendances
npm install

# Créer le fichier .env
echo "VITE_API_URL=http://localhost:5000" > .env
```

## 🎮 Démarrage

### Démarrer le Backend
```bash
cd server
npm run dev
```
Le serveur démarre sur `http://localhost:5000`

### Démarrer le Frontend
```bash
cd client
npm run dev
```
L'application démarre sur `http://localhost:5173`

## 📁 Structure du Projet

```
yugioh-collection-manager/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/    # Composants réutilisables
│   │   ├── pages/         # Pages de l'application
│   │   ├── services/      # API client, Socket.io
│   │   ├── context/       # Context API (Auth, Notifications)
│   │   ├── hooks/         # Custom hooks
│   │   ├── types/         # Types TypeScript
│   │   └── assets/        # Images, styles
│   ├── package.json
│   └── vite.config.ts
│
├── server/                 # Backend Express
│   ├── src/
│   │   ├── config/        # Database, config files
│   │   ├── controllers/   # Route handlers
│   │   ├── middleware/    # Auth, validation, upload
│   │   ├── models/        # Database models
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic, API integrations
│   │   ├── types/         # Types TypeScript
│   │   ├── utils/         # Utilitaires
│   │   └── index.ts       # Entry point
│   ├── uploads/           # Fichiers uploadés (gitignored)
│   ├── package.json
│   └── tsconfig.json
│
└── shared/                 # Types partagés
    └── types/
        └── index.ts        # Interfaces communes
```

## 🔑 Variables d'Environnement

### Backend (.env)
```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=yugioh_collection
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRES_IN=7d

# Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880

# API
YGOPRODECK_API_URL=https://db.ygoprodeck.com/api/v7

# Client URL (pour CORS)
CLIENT_URL=http://localhost:5173
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Créer un compte
- `POST /api/auth/login` - Se connecter
- `GET /api/auth/profile` - Obtenir le profil (auth required)

### Collection
- `GET /api/collection` - Obtenir la collection (avec filtres)
- `POST /api/collection/add` - Ajouter une carte par code
- `DELETE /api/collection/:id` - Retirer une carte

### Decks
- `GET /api/decks` - Liste des decks (avec filtres)
- `GET /api/decks/:id` - Détails d'un deck
- `POST /api/decks` - Créer un deck
- `PUT /api/decks/:id` - Modifier un deck
- `DELETE /api/decks/:id` - Supprimer un deck
- `POST /api/decks/:id/cards` - Ajouter une carte au deck
- `DELETE /api/decks/:id/cards/:cardId` - Retirer une carte du deck

### Social
- `POST /api/social/follow/:userId` - Follow un utilisateur
- `DELETE /api/social/unfollow/:userId` - Unfollow un utilisateur
- `GET /api/social/followers` - Liste des followers
- `GET /api/social/following` - Liste des following
- `GET /api/social/users/search` - Rechercher des utilisateurs

### Reactions
- `POST /api/reactions/:deckId/like` - Liker un deck
- `POST /api/reactions/:deckId/dislike` - Disliker un deck
- `DELETE /api/reactions/:deckId` - Retirer sa réaction

### Comments
- `GET /api/comments/deck/:deckId` - Commentaires d'un deck
- `POST /api/comments/deck/:deckId` - Ajouter un commentaire
- `POST /api/comments/:commentId/reply` - Répondre à un commentaire
- `DELETE /api/comments/:commentId` - Supprimer un commentaire

### Notifications
- `GET /api/notifications` - Liste des notifications
- `PUT /api/notifications/:id/read` - Marquer comme lu
- `PUT /api/notifications/read-all` - Tout marquer comme lu

## 🎯 Règles de Validation des Decks

### Main Deck
- ✅ Minimum 40 cartes
- ✅ Maximum 60 cartes
- ❌ Pas de monstres Fusion/Synchro/Xyz/Link

### Extra Deck
- ✅ Maximum 15 cartes
- ✅ Uniquement monstres Fusion/Synchro/Xyz/Link

### Copies
- ✅ Maximum 3 copies par carte (sauf si banlist activée)

### Banlist TCG (si activée)
- ❌ **Forbidden**: 0 copie autorisée
- ⚠️ **Limited**: 1 copie maximum
- ⚠️ **Semi-Limited**: 2 copies maximum

## 🧪 Tests

### Backend
```bash
cd server
npm test
```

### Frontend
```bash
cd client
npm test
```

## 🏗️ Build Production

### Backend
```bash
cd server
npm run build
npm start
```

### Frontend
```bash
cd client
npm run build
# Les fichiers sont dans dist/
```

## 🐛 Débogage

### Problèmes courants

#### Erreur de connexion PostgreSQL
```
Error: connect ECONNREFUSED
```
**Solution**: Vérifiez que PostgreSQL est démarré et que les credentials dans `.env` sont corrects.

#### Erreur JWT
```
Error: Invalid or expired token
```
**Solution**: Reconnectez-vous pour obtenir un nouveau token.

#### Upload d'images ne fonctionne pas
**Solution**: Vérifiez que le dossier `uploads/` existe et a les bonnes permissions.

## 🤝 Contribution

1. Fork le projet
2. Créez une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push sur la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📝 Licence

Ce projet est sous licence MIT.

## 👤 Auteur

**Kevin Lettron**
- GitHub: [@Kevin-Lettron](https://github.com/Kevin-Lettron)
- Email: kevinlettron@gmail.com

## 🙏 Remerciements

- [YGOProDeck API](https://ygoprodeck.com/api-guide/) pour les données des cartes
- La communauté Yu-Gi-Oh!

## 🔮 Roadmap

- [ ] Reconnaissance OCR des cartes via photo
- [ ] Export/Import de decks (format .ydk)
- [ ] Statistiques de collection (valeur totale, etc.)
- [ ] Mode offline (PWA)
- [ ] Application mobile (React Native)
- [ ] Système de trade entre utilisateurs
- [ ] Intégration prix des cartes en temps réel

---

**Note**: Ce projet est en cours de développement. Certaines fonctionnalités peuvent être incomplètes ou en cours d'implémentation.
