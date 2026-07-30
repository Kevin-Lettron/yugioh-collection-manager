# Guide de déploiement auto — Réutilisable pour tous mes projets

Procédure pour mettre en place un déploiement automatisé (git push → prod) sur un VPS DigitalOcean, avec HTTPS, backups, monitoring et CI/CD.

Fonctionne pour n'importe quel projet web : **Node.js / Python / PHP / Ruby / Go**, avec ou sans base de données.

---

# PARTIE 1 — Guide personnel

## Vue d'ensemble

À la fin de ce guide, tu auras :

- ✅ Un serveur VPS chez DigitalOcean, sécurisé
- ✅ Un nom de domaine pointant dessus, en HTTPS gratuit (Let's Encrypt, auto-renew)
- ✅ Ton app accessible publiquement, gérée par un process manager
- ✅ Une base de données locale (si besoin), avec backups quotidiens auto
- ✅ Un pipeline CI/CD : `git push origin master` → déploiement automatique en prod ~2 min plus tard
- ✅ Un monitoring uptime gratuit
- ✅ Architecture multi-apps : le même serveur peut héberger plusieurs projets

**Coût mensuel** : ~15 $/mois (12 $ Droplet + 2 $ backups DO + 7 €/an domaine)

## Architecture cible

```
                        Internet
                            |
                    +-------v--------+
                    |  nginx (:443)  |  reverse proxy + SSL
                    +-------+--------+
              +-------------+-------------+
              |             |             |
        +-----v----+  +-----v----+  +-----v----+
        |  app 1   |  |  app 2   |  |  app 3   |  processus gérés par
        |  :5000   |  |  :5001   |  |  :5002   |  PM2 / systemd / supervisord
        +-----+----+  +-----+----+  +-----+----+
              |             |             |
              +-------------v-------------+
                    Base de données locale
                (PostgreSQL / MySQL / ...)
```

Chaque nouvelle app = nouveau dossier `/home/deploy/apps/<nom>/` + nouveau server block nginx + nouveau process.

---

## Prérequis avant de commencer

- [ ] Compte **DigitalOcean** (5$ de crédit à l'inscription)
- [ ] Compte chez un **registrar** de domaine (OVH, Namecheap, Porkbun...)
- [ ] Compte **GitHub** avec le repo du projet
- [ ] **Git** installé sur ton PC
- [ ] **PowerShell** (Windows) ou **Terminal** (Mac/Linux) sur ton PC
- [ ] Carte bancaire pour DigitalOcean

---

## Étape 1 — Provisioning du serveur

### 1.1 Générer une clé SSH sur ton PC

```powershell
# PowerShell
ssh-keygen -t ed25519 -C "ma-machine"
# Entrée pour path par défaut, entrée pour passphrase vide
Get-Content C:\Users\<toi>\.ssh\id_ed25519.pub | Set-Clipboard
```

### 1.2 Ajouter la clé à DigitalOcean

- https://cloud.digitalocean.com/account/security → **Add SSH Key**
- Colle le contenu du presse-papier, nom au choix, valider

### 1.3 Créer un Droplet

- **Region** : le plus proche géographiquement (Frankfurt / Amsterdam / Paris)
- **OS** : Ubuntu 24.04 LTS x64
- **Plan** : Basic Regular, 2 vCPU / 2 GB RAM / 50 GB SSD (~12 $/mois) — suffisant pour 3-5 apps modestes
- **Authentication** : SSH Key → coche celle que tu viens d'ajouter
- **Options** : coche **Backups automatiques** (+2 $/mois) et **IPv6** (gratuit)
- **Hostname** : à ton goût
- **Create Droplet**

Note l'**IPv4 publique** — on l'utilisera partout.

### 1.4 Test SSH

```powershell
ssh root@<IP>
# tape "yes" pour la fingerprint
# Tu dois voir root@hostname:~#
exit
```

---

## Étape 2 — Domaine + DNS

### 2.1 Acheter un domaine

Chez OVH, Porkbun ou Namecheap (5-15 €/an). Éviter GoDaddy, 1&1.

### 2.2 Pointer les A records vers ton IP

Dans le panneau DNS du registrar :

| Type | Sous-domaine | Cible |
|---|---|---|
| A | (vide = `@`) | `<IP du Droplet>` |
| A | `www` | `<IP du Droplet>` |

Supprime les A records par défaut qui pointent vers le registrar.

### 2.3 Vérifier la propagation (5-30 min)

```powershell
nslookup mondomaine.fr
# Doit répondre l'IP du Droplet, pas celle du registrar
```

---

## Étape 3 — Hardening du serveur

Toutes les commandes se lancent en SSH sur le serveur.

### 3.1 Update packages

```bash
ssh root@<IP>
apt update && apt upgrade -y
```

À chaque prompt de config file : choisis "keep the local version" (safe).

### 3.2 Créer un user `deploy` avec sudo

```bash
adduser deploy
# Entre un mot de passe fort (12+ chars) — à sauvegarder dans Bitwarden
# Entrée 5 fois pour skip les infos optionnelles, Y pour confirmer

usermod -aG sudo deploy

# Copier la clé SSH root → deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 3.3 Test connexion `deploy` (dans un AUTRE terminal, garde root ouvert)

```powershell
ssh deploy@<IP>
sudo whoami   # doit répondre "root" après avoir tapé le mdp deploy
```

Si OK, tu peux fermer la session root (`exit` dans l'autre terminal).

### 3.4 Firewall UFW

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

### 3.5 Updates de sécurité auto

```bash
sudo apt install -y unattended-upgrades
echo 'APT::Periodic::Update-Package-Lists "1";' | sudo tee /etc/apt/apt.conf.d/20auto-upgrades
echo 'APT::Periodic::Unattended-Upgrade "1";' | sudo tee -a /etc/apt/apt.conf.d/20auto-upgrades
```

### 3.6 Désactiver SSH root + password auth

```bash
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf > /dev/null <<'EOF'
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
EOF
sudo systemctl reload ssh
```

Test depuis PC :
```powershell
ssh root@<IP>   # doit répondre "Permission denied"
```

### 3.7 Reboot pour activer le nouveau kernel

```bash
sudo reboot
# Attendre ~30-60s puis reconnecter
ssh deploy@<IP>
```

---

## Étape 4 — Installation de la stack

Le contenu varie selon ton projet. Voici les 3 profils les plus courants.

### 4.a Stack Node.js + PostgreSQL

```bash
sudo apt install -y curl git build-essential ca-certificates gnupg
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib nginx certbot python3-certbot-nginx
sudo npm install -g pm2
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy
```

### 4.b Stack Python + PostgreSQL

```bash
sudo apt install -y python3 python3-pip python3-venv git nginx postgresql postgresql-contrib certbot python3-certbot-nginx
# Process manager : systemd (via unit file) ou gunicorn+systemd, ou supervisord
sudo apt install -y supervisor
```

### 4.c Stack PHP + MySQL

```bash
sudo apt install -y php php-fpm php-mysql php-cli php-mbstring php-xml php-curl git nginx mysql-server certbot python3-certbot-nginx
sudo systemctl enable --now mysql php8.3-fpm
sudo mysql_secure_installation
```

### 4.d Sans DB (site statique / API stateless)

```bash
sudo apt install -y git nginx certbot python3-certbot-nginx
# + le runtime de ton projet (Node, Python, Go binary, etc.)
```

---

## Étape 5 — Créer la base de données (si applicable)

Adapte selon PostgreSQL / MySQL / MongoDB.

### PostgreSQL

```bash
# Générer un password fort
DB_PASSWORD=$(openssl rand -hex 24)
echo "DB Password : $DB_PASSWORD"    # copie-le dans Bitwarden !

# Créer user + DB
sudo -u postgres psql <<EOF
CREATE USER monapp WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE monapp_db OWNER monapp;
GRANT ALL PRIVILEGES ON DATABASE monapp_db TO monapp;
EOF

# Test
PGPASSWORD="$DB_PASSWORD" psql -U monapp -h localhost -d monapp_db -c "SELECT 'ok';"
```

---

## Étape 6 — Clé SSH pour puller le repo GitHub

Sur le serveur, en `deploy` :

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N '' -C 'server-deploy'
cat ~/.ssh/github_deploy.pub
```

**Copie la clé publique** → GitHub → **repo Settings** → **Deploy keys** → **Add deploy key**
- Title : nom serveur
- Key : coller le contenu
- **Allow write access : NON** (read-only suffit)

Puis config SSH :

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

# Test
ssh -T git@github.com
# Doit dire "Hi <user>/<repo>! You've successfully authenticated"
```

---

## Étape 7 — Clone + config + build + démarrer

### 7.1 Cloner le repo

```bash
mkdir -p ~/apps
cd ~/apps
git clone git@github.com:<user>/<repo>.git monapp
cd monapp
```

### 7.2 Créer le fichier `.env` de prod

Adapte selon ton framework. **Ne jamais versionner ce fichier** (doit être dans `.gitignore`).

```bash
cat > .env <<EOF
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://monapp:$DB_PASSWORD@localhost:5432/monapp_db
JWT_SECRET=$(openssl rand -hex 32)
# + toutes les autres variables de ton projet
EOF
chmod 600 .env
```

### 7.3 Installer deps + build

**Node.js** :
```bash
npm ci
npm run build
```

**Python** :
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**PHP (Composer)** :
```bash
composer install --no-dev --optimize-autoloader
```

### 7.4 Jouer le schéma DB (si applicable)

```bash
PGPASSWORD="$DB_PASSWORD" psql -U monapp -h localhost -d monapp_db -f server/db/schema.sql
# + migrations
```

### 7.5 Démarrer le process

**Node.js avec PM2** :
```bash
pm2 start dist/index.js --name monapp
pm2 save
```

**Python avec systemd** : créer un unit file `/etc/systemd/system/monapp.service` et `systemctl enable --now monapp`.

**PHP-FPM** : rien à faire, php-fpm gère les workers automatiquement.

### 7.6 Test rapide

```bash
curl http://localhost:5000/health
# Doit répondre 200 OK
```

---

## Étape 8 — nginx reverse proxy + HTTPS

### 8.1 Server block nginx

Template Node.js/SPA :

```bash
sudo chmod o+x /home/deploy   # nginx (www-data) doit pouvoir traverser
sudo chmod -R o+rX /home/deploy/apps/monapp/client/dist

sudo tee /etc/nginx/sites-available/monapp > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name mondomaine.fr www.mondomaine.fr;

    root /home/deploy/apps/monapp/client/dist;
    index index.html;

    client_max_body_size 10M;

    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # (Adapter selon les autres endpoints du backend)

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/monapp /etc/nginx/sites-enabled/monapp
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Test : `http://mondomaine.fr` doit afficher ton app.

### 8.2 HTTPS via Certbot

```bash
sudo certbot --nginx -d mondomaine.fr -d www.mondomaine.fr
# Suivre le prompt : email, agree TOS (Y), newsletter (N), redirect (2)
```

Résultat : `https://mondomaine.fr` avec cadenas vert, redirect auto HTTP→HTTPS, renouvellement automatique tous les 60 jours.

---

## Étape 9 — Backups DB automatiques

Créer 2 scripts dans ton repo (à commit) puis programmer via cron.

### 9.1 Scripts (à créer dans le repo)

`scripts/backup-db.sh` :
```bash
#!/bin/bash
set -euo pipefail
DB_NAME="monapp_db"
DB_USER="monapp"
BACKUP_DIR="/home/deploy/backups"
RETENTION_DAYS=7

if [[ -z "${DB_PASSWORD:-}" ]]; then echo "DB_PASSWORD required" >&2; exit 1; fi
mkdir -p "$BACKUP_DIR"
TS=$(date +%Y-%m-%d_%H-%M-%S)
FILE="$BACKUP_DIR/${DB_NAME}_${TS}.sql.gz"
PGPASSWORD="$DB_PASSWORD" pg_dump -h localhost -U "$DB_USER" --no-owner --no-acl --clean --if-exists "$DB_NAME" | gzip > "$FILE"
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
echo "Backup done: $FILE"
```

`scripts/backup-db-cron.sh` (wrapper cron qui charge le .env) :
```bash
#!/bin/bash
set -euo pipefail
ENV_FILE="/home/deploy/apps/monapp/.env"
LOG="/home/deploy/backups/backup.log"
mkdir -p "$(dirname "$LOG")"
DB_PASSWORD=$(grep '^DATABASE_URL\|^DB_PASSWORD' "$ENV_FILE" | head -1 | sed 's|.*:\([^@]*\)@.*|\1|' | sed 's/^DB_PASSWORD=//')
export DB_PASSWORD
bash /home/deploy/apps/monapp/scripts/backup-db.sh >> "$LOG" 2>&1
```

### 9.2 Setup cron

```bash
chmod +x /home/deploy/apps/monapp/scripts/*.sh
mkdir -p /home/deploy/backups
/home/deploy/apps/monapp/scripts/backup-db-cron.sh   # test manuel
(crontab -l 2>/dev/null; echo "0 3 * * * /home/deploy/apps/monapp/scripts/backup-db-cron.sh") | crontab -
```

### 9.3 Restore (procédure d'urgence)

```bash
gunzip -c /home/deploy/backups/monapp_db_2026-XX-XX.sql.gz | \
  PGPASSWORD="$DB_PASSWORD" psql -h localhost -U monapp -d monapp_db
```

---

## Étape 10 — GitHub Actions CI/CD

### 10.1 Générer une clé SSH dédiée GH Actions

Sur le serveur :
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_actions -N '' -m PEM -C 'github-actions'
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_actions   # copier la clé privée
```

⚠️ **Utiliser RSA PEM et pas ed25519** : plus de compatibilité avec `appleboy/ssh-action`.

### 10.2 Ajouter les secrets sur GitHub

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Nom | Valeur |
|---|---|
| `SERVER_HOST` | IP du serveur |
| `SERVER_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | Contenu complet de `~/.ssh/github_actions` (avec BEGIN/END) |
| `DB_PASSWORD` | Le password DB |

### 10.3 Créer `.github/workflows/deploy.yml`

Dans ton repo local, créer le fichier :

```yaml
name: Deploy to production

on:
  push:
    branches: [master]
  workflow_dispatch:

concurrency:
  group: deploy-prod
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Deploy over SSH
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: 22
          script_stop: true
          command_timeout: 15m
          script: |
            set -euo pipefail
            cd /home/deploy/apps/monapp
            echo "▶ Pulling..."
            git pull origin master
            echo "▶ Installing deps..."
            npm ci     # ou : pip install -r requirements.txt / composer install
            echo "▶ Building..."
            npm run build
            echo "▶ Migrations..."
            for f in scripts/migrations/*.sql; do
              PGPASSWORD='${{ secrets.DB_PASSWORD }}' psql -U monapp -h localhost -d monapp_db -f "$f"
            done
            echo "▶ Restart..."
            pm2 restart monapp
            pm2 save
            echo "✅ Deploy OK: $(git rev-parse --short HEAD)"
```

Commit + push. À chaque push sur `master`, GH Actions déploie automatiquement.

Test : va sur repo → **Actions** → tu vois le workflow qui tourne.

---

## Étape 11 — Alias PowerShell (bonus)

Pour déployer manuellement sans passer par le workflow (test rapide, rollback) :

```powershell
# Vérifier / créer le profil
Test-Path $PROFILE
New-Item -Path $PROFILE -Type File -Force   # si pas existant
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

# Éditer
notepad $PROFILE
```

Coller :
```powershell
function monapp-deploy {
    Set-Location "C:\chemin\vers\repo\monapp"
    git push origin master
    if ($LASTEXITCODE -ne 0) { Write-Host "Push failed" -ForegroundColor Red; return }
    ssh deploy@<IP> 'set -e; cd /home/deploy/apps/monapp && git pull && npm ci && npm run build && pm2 restart monapp && pm2 save && echo Deploy OK'
}
```

Recharger : `. $PROFILE`

Usage : `monapp-deploy` depuis n'importe où.

---

## Étape 12 — Uptime monitoring (5 min)

- **[uptimerobot.com](https://uptimerobot.com)** → Sign Up Free
- **New monitor** : HTTP(s), URL `https://mondomaine.fr/api/health` (ajouter un endpoint `/health` dans l'app si absent), interval 5 min
- Notif email en cas de downtime > 5 min

Alternatives : Better Stack (interface plus polie), Hetrix Tools (5 min interval free).

---

## Checklist finale

Pour t'assurer que rien n'est oublié :

- [ ] SSH `deploy@<IP>` fonctionne sans password
- [ ] SSH root est bloqué (`ssh root@<IP>` répond "Permission denied")
- [ ] UFW actif, ports 22/80/443 ouverts uniquement
- [ ] `https://mondomaine.fr` affiche l'app avec cadenas vert
- [ ] Redirect HTTP → HTTPS fonctionne
- [ ] `pm2 status` (ou équivalent) → app **online**
- [ ] `curl https://mondomaine.fr/api/health` → 200 OK
- [ ] Backup DB test manuel réussi + cron ajouté
- [ ] GitHub Actions : workflow vert après un push test
- [ ] Uptime Robot : monitor ajouté + email confirmé
- [ ] Secrets (.env, JWT_SECRET, DB_PASSWORD, SSH keys) sauvegardés dans un gestionnaire de mots de passe

---

# PARTIE 2 — Prompt à donner à Claude Code

Copie-colle ce prompt dans Claude Code au début d'un nouveau projet à déployer. Adapte les infos entre `<...>` au préalable.

---

```
Je veux déployer mon projet en prod sur DigitalOcean avec le même setup que ma
config actuelle. Voici les infos :

INFOS DU PROJET
- Nom du projet : <ex: monapp>
- Stack : <ex: Node.js 20 + React/Vite frontend + PostgreSQL 16>
- Repo GitHub : https://github.com/<user>/<repo>
- Branche prod : <master ou main>
- Framework backend : <ex: Express, FastAPI, Rails, Laravel...>
- Framework frontend : <ex: React/Vite, Next.js, Vue, SPA statique, aucun...>
- Base de données : <PostgreSQL / MySQL / MongoDB / aucune>
- Port du backend : <5000 par défaut, ou autre>
- Commande de build : <ex: npm run build, python setup.py build, mvn package...>
- Commande de start : <ex: node dist/index.js, gunicorn app:app, php artisan serve>
- Fichier .env : <ex: server/.env, .env à la racine>

INFOS DU SERVEUR
- Le Droplet est déjà provisionné, Ubuntu 24.04
- IP publique : <IP>
- Domaine : <mondomaine.fr>
- User SSH non-root déjà créé : deploy
- Ma clé SSH publique est déjà dans ~/.ssh/authorized_keys du user deploy
- Le hardening basique est déjà fait (UFW, no root SSH, unattended-upgrades)

CE QUE JE VEUX QUE TU FASSES

1. Installe la stack sur le serveur (adapte selon ma techno) :
   - runtime (Node/Python/PHP/etc.)
   - base de données si applicable
   - nginx, certbot, process manager (PM2 / systemd / supervisord)

2. Crée la DB avec un password généré aléatoirement. Affiche-le-moi UNE fois
   au début pour que je le sauvegarde.

3. Set up une deploy key SSH pour puller le repo GitHub depuis le serveur.
   Guide-moi pas à pas pour l'ajouter côté GitHub (repo Settings → Deploy keys).

4. Clone le repo dans /home/deploy/apps/<nom>/. Crée le fichier .env de prod
   avec :
   - un JWT_SECRET aléatoire (openssl rand -hex 32)
   - la connexion DB pointant en local
   - toutes les variables spécifiques à mon projet (demande-moi lesquelles)

5. Installe les deps, build le projet, joue le schéma SQL initial et les
   migrations si présentes.

6. Configure le process manager pour démarrer le backend en arrière-plan avec
   restart automatique au reboot serveur.

7. Configure nginx en reverse proxy :
   - Sert le frontend depuis dist/ (si SPA)
   - Proxy /api → backend local
   - SPA fallback pour React Router / Vue Router si applicable
   - client_max_body_size 10M pour les uploads

8. Certbot pour HTTPS Let's Encrypt sur mondomaine.fr et www.mondomaine.fr.
   Force le redirect HTTP → HTTPS.

9. Set up les backups DB automatiques :
   - Script dans scripts/backup-db.sh (à commit dans le repo)
   - Wrapper cron dans scripts/backup-db-cron.sh
   - pg_dump quotidien à 3h du matin, gzipé, 7 jours de rétention dans
     /home/deploy/backups/
   - Documente comment restore

10. Set up GitHub Actions pour l'auto-deploy :
    - Génère une clé SSH RSA 4096 en format PEM sur le serveur (compatibilité
      appleboy/ssh-action)
    - Guide-moi pour ajouter les 4 secrets côté GitHub :
      SERVER_HOST, SERVER_USER, SSH_PRIVATE_KEY, DB_PASSWORD (si applicable)
    - Crée .github/workflows/deploy.yml qui fait pull + install + build +
      migrations + restart process, avec concurrency: deploy-prod pour éviter
      les race conditions

11. Ajoute un endpoint /api/health dans le backend (JSON simple avec status:
    ok) pour l'uptime monitoring, si absent.

12. Écris un fichier DEPLOYMENT.md à la racine du repo qui documente :
    - L'architecture (nginx, process manager, DB)
    - Où sont les fichiers de config (.env, nginx sites-available, systemd
      units)
    - Les commandes de debug utiles (pm2 logs, nginx error log, etc.)
    - Comment restore un backup
    - Comment ajouter un nouveau secret / mettre à jour .env

13. Écris-moi la commande "deploy inline" pour PowerShell (une seule ligne
    SSH qui fait tout), au cas où je veuille déployer sans passer par
    GitHub Actions.

WORKFLOW ATTENDU APRÈS SETUP

- Je push sur master → GitHub Actions déploie automatiquement en ~2 min
- Mon app est accessible sur https://mondomaine.fr avec cadenas vert
- Les backups DB tournent tous les jours à 3h
- Uptime Robot (que je vais setup moi-même) me ping toutes les 5 min

RÈGLES

- Guide-moi étape par étape, pas tout d'un coup — attends que je confirme
  chaque étape avant la suivante
- Utilise des heredocs pour les commandes multilignes (évite les problèmes
  de paste sous PowerShell)
- N'affiche jamais mes secrets (CLAUDE_API_KEY, DB_PASSWORD) en clair après
  génération — demande-moi de les mettre à la main dans le .env via nano
- Explique brièvement le POURQUOI de chaque étape, pas juste le COMMENT
- Adapte les commandes à ma stack (pas de copier-coller de Node.js si je
  suis en Python)
```

---

## Comment convertir ce doc en Word

**Option 1 — Ouvrir directement dans Word**
Word 2016+ ouvre les .md nativement : clic droit sur le fichier → **Ouvrir avec** → **Word**. Le rendu n'est pas parfait (tableaux moches parfois), mais c'est lisible.

**Option 2 — Copier-coller depuis un preview Markdown**
- Ouvre le .md dans VS Code
- Clic droit → **Open Preview** (ou `Ctrl+Shift+V`)
- Sélectionne tout (`Ctrl+A`) → copie
- Colle dans un doc Word vide → les styles, tableaux, code blocks sont préservés

**Option 3 — Pandoc (résultat le plus propre)**
Installer Pandoc puis :
```powershell
pandoc DEPLOYMENT-GUIDE.md -o DEPLOYMENT-GUIDE.docx
```

**Option 4 — Web**
Coller le contenu sur https://word2md.com (inverse) ou https://cloudconvert.com/md-to-docx (upload le .md).

Recommandation : **Option 3 (Pandoc)** pour un rendu propre, ou **Option 2** si tu veux juste garder le contenu accessible.

---

**Fichier créé** : `DEPLOYMENT-GUIDE.md` à la racine du repo. Tu peux le versionner (utile pour toi et pour les futurs contributeurs) ou le sortir du repo pour un usage perso.
