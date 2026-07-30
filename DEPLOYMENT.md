# Déploiement — YuGiOh Collection Manager

Documentation du serveur de production `keitland.eu` (Droplet DigitalOcean, Ubuntu 24.04).

## Architecture

```
Internet → nginx (:80/:443) → {
  static files: /home/deploy/apps/yugioh/client/dist
  /api/*, /uploads/*, /socket.io/* → localhost:5000 (Node.js PM2)
}
                                        ↓
                                    PostgreSQL 16 (localhost:5432)
```

- **User Linux** : `deploy` (sudo, sans password root SSH)
- **Node** : 20 LTS, backend via `pm2 start yugioh-api`
- **DB** : PostgreSQL 16 local, user `yugioh`, DB `yugioh_collection`
- **HTTPS** : Let's Encrypt via Certbot, auto-renew
- **Firewall** : UFW (22, 80, 443)

---

## Déploiement quotidien

### Option 1 — Alias PowerShell (déploiement manuel)

Depuis ton PC, dans n'importe quel PowerShell :

```powershell
yugioh-deploy
```

Fait : `git push` → SSH sur le serveur → pull + install + build + migrations + PM2 restart.

Voir `$PROFILE` pour la définition de la fonction.

### Option 2 — GitHub Actions (auto sur push)

À chaque `git push origin master`, le workflow `.github/workflows/deploy.yml` déclenche un SSH vers le serveur et exécute la même chaîne. Voir la section "Setup GitHub Actions" plus bas.

### Option 3 — Commande inline

```powershell
ssh deploy@167.99.132.65 'set -e; cd /home/deploy/apps/yugioh && git pull origin master && cd server && npm ci && npx tsc && cd ../client && npm ci && npm run build && cd .. && for f in server/src/config/migrations/*.sql; do echo "▶ Migration: $f"; PGPASSWORD=PEBmkJwKgI1d6C5VBj7RdE9klumk6laP psql -U yugioh -h localhost -d yugioh_collection -f "$f"; done && pm2 restart yugioh-api && pm2 save && echo "✅ Deploy OK"'
```

---

## Setup initial (à ne faire qu'une fois)

### Backups PostgreSQL automatiques

Sur le serveur en tant que `deploy` :

```bash
# 1. Rendre les scripts exécutables (déjà versionnés)
chmod +x /home/deploy/apps/yugioh/server/scripts/*.sh

# 2. Créer le dossier des backups
mkdir -p /home/deploy/backups

# 3. Test manuel
/home/deploy/apps/yugioh/server/scripts/backup-db-cron.sh
ls -lh /home/deploy/backups/

# 4. Programmer via crontab — dump quotidien à 3h du matin
(crontab -l 2>/dev/null; echo "0 3 * * * /home/deploy/apps/yugioh/server/scripts/backup-db-cron.sh") | crontab -

# 5. Vérifier le cron actif
crontab -l
```

**Rétention** : 7 jours (configurable dans `backup-db.sh`).
**Localisation** : `/home/deploy/backups/yugioh_collection_YYYY-MM-DD_HH-MM-SS.sql.gz`.
**Log** : `/home/deploy/backups/backup.log`.

### Restaurer un backup

```bash
bash /home/deploy/apps/yugioh/server/scripts/restore-db.sh /home/deploy/backups/yugioh_collection_2026-04-21_03-00-00.sql.gz
```

Le script te demande une confirmation, stoppe PM2, restaure via `psql`, redémarre PM2.

### Copier les backups sur ton PC (optionnel mais recommandé)

Depuis PowerShell sur ton PC :
```powershell
scp deploy@167.99.132.65:/home/deploy/backups/yugioh_collection_*.sql.gz C:\Users\Kevin\Backups\yugioh\
```

Automatiser via tâche planifiée Windows si tu veux du off-site backup.

---

## Setup GitHub Actions

Une seule fois pour activer le déploiement auto sur push.

### 1. Générer une clé SSH dédiée sur le serveur

Sur le serveur en tant que `deploy` :

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_actions -N '' -C 'github-actions@keitland'

# Ajouter la clé publique aux autorisations SSH du user deploy
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# Récupérer la clé privée (à copier dans GitHub Secrets)
cat ~/.ssh/github_actions
```

**Copie tout le contenu** de la clé privée (incluant les lignes `-----BEGIN OPENSSH PRIVATE KEY-----` et `-----END OPENSSH PRIVATE KEY-----`).

### 2. Ajouter les secrets dans GitHub

Va sur : `https://github.com/Kevin-Lettron/yugioh-collection-manager/settings/secrets/actions`

Bouton **New repository secret**, crée les 4 secrets :

| Nom | Valeur |
|---|---|
| `SERVER_HOST` | `167.99.132.65` |
| `SERVER_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | Le contenu complet de `~/.ssh/github_actions` du serveur |
| `DB_PASSWORD` | `PEBmkJwKgI1d6C5VBj7RdE9klumk6laP` (le mot de passe DB, utilisé pour les migrations) |

### 3. Test

Fais un commit + push, ou déclenche manuellement depuis l'onglet **Actions** du repo GitHub :

```powershell
cd c:\laragon\www\New-YugiohCollection
git commit --allow-empty -m "test: trigger auto-deploy"
git push origin master
```

Va sur **Actions** dans GitHub → tu dois voir le workflow "Deploy to production" en cours puis vert.

---

## Debug / Monitoring

### Logs de l'API en temps réel

```bash
ssh deploy@167.99.132.65
pm2 logs yugioh-api --lines 100
```

### Status des services

```bash
pm2 status                          # PM2
sudo systemctl status nginx         # nginx
sudo systemctl status postgresql    # PostgreSQL
```

### Voir les erreurs récentes

```bash
tail -50 /home/deploy/apps/yugioh/server/logs/error-*.log
```

### Logs nginx

```bash
sudo tail -50 /var/log/nginx/access.log
sudo tail -50 /var/log/nginx/error.log
```

### Reload nginx après modif de config

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Vérifier le renouvellement HTTPS

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

---

## Fichiers de config critiques (ne pas commit)

- `server/.env` — secrets, DB password, JWT secret, CLAUDE_API_KEY
- `client/.env` — URLs (vides en prod, chemins relatifs via nginx)
- `~/.ssh/github_deploy` — clé lecture repo GitHub
- `~/.ssh/github_actions` — clé pour CI/CD (créée pour GH Actions)
- `~/.ssh/authorized_keys` — clés autorisées à se connecter au serveur

---

## Ressources et coûts

- **Droplet DigitalOcean** : 12 $/mois (Basic Regular, 2 vCPU, 2 GB RAM, 50 GB SSD, Frankfurt)
- **Domaine OVH** : ~7 €/an (.eu)
- **HTTPS** : gratuit (Let's Encrypt)
- **Backups DO** : optionnels (+2 $/mois pour snapshots hebdo)
- **Total** : ~15 $/mois
