#!/bin/bash
# Génère un rapport complet du serveur.
# Usage : bash server-report.sh
# Ou avec output fichier : bash server-report.sh > /tmp/rapport-$(date +%Y%m%d).txt
set +e

header() {
  echo
  echo "════════════════════════════════════════════════════════════════"
  echo "  $1"
  echo "════════════════════════════════════════════════════════════════"
}

header "SYSTÈME"
echo "Hostname   : $(hostname)"
echo "OS         : $(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '"')"
echo "Kernel     : $(uname -r)"
echo "Uptime     : $(uptime -p)"
echo "Timezone   : $(timedatectl | grep 'Time zone' | awk '{print $3}')"
echo "Date now   : $(date -Iseconds)"

header "HARDWARE"
echo "CPU        : $(nproc) cores / $(grep 'model name' /proc/cpuinfo | head -1 | cut -d: -f2 | xargs)"
echo "RAM        : $(free -h | awk '/^Mem:/ {print $2 " total, " $3 " used, " $7 " available"}')"
echo "Disk /     : $(df -h / | awk 'NR==2 {print $2 " total, " $3 " used (" $5 "), " $4 " free"}')"
echo "Load avg   : $(uptime | grep -oP 'load average: \K.*')"

header "RÉSEAU"
echo "IPv4 pub   : $(curl -s -4 https://ifconfig.me 2>/dev/null || echo N/A)"
echo "IPv6 pub   : $(curl -s -6 https://ifconfig.me 2>/dev/null || echo N/A)"
echo
echo "Interfaces :"
ip -brief addr | grep -v "^lo"
echo
echo "Ports en écoute :"
sudo ss -tulpn 2>/dev/null | grep LISTEN | awk '{print $1, $5, $7}' | column -t

header "FIREWALL (UFW)"
sudo ufw status verbose 2>/dev/null

header "VERSIONS INSTALLÉES"
printf "%-15s %s\n" "Node.js"    "$(node --version 2>/dev/null || echo 'non installé')"
printf "%-15s %s\n" "npm"        "$(npm --version 2>/dev/null || echo 'non installé')"
printf "%-15s %s\n" "PM2"        "$(pm2 --version 2>/dev/null || echo 'non installé')"
printf "%-15s %s\n" "PostgreSQL" "$(psql --version 2>/dev/null | awk '{print $3}' || echo 'non installé')"
printf "%-15s %s\n" "Nginx"      "$(nginx -v 2>&1 | awk -F/ '{print $2}' || echo 'non installé')"
printf "%-15s %s\n" "Certbot"    "$(certbot --version 2>&1 | awk '{print $2}' || echo 'non installé')"
printf "%-15s %s\n" "Git"        "$(git --version 2>/dev/null | awk '{print $3}' || echo 'non installé')"

header "SERVICES (systemd)"
for svc in nginx postgresql ssh ufw unattended-upgrades certbot.timer; do
  status=$(systemctl is-active "$svc" 2>/dev/null)
  enabled=$(systemctl is-enabled "$svc" 2>/dev/null)
  printf "%-25s active=%-10s enabled=%s\n" "$svc" "$status" "$enabled"
done

header "PM2 PROCESSES"
pm2 list 2>/dev/null

header "NGINX — SITES ACTIFS"
ls -la /etc/nginx/sites-enabled/ | grep -v '^total\|^d' | awk '{print $9, "→", $11}'
echo
echo "nginx -t :"
sudo nginx -t 2>&1

header "NGINX — DÉTAIL DES SERVER BLOCKS"
for site in /etc/nginx/sites-enabled/*; do
  echo "── $(basename $site) ─────────"
  sudo cat "$site"
  echo
done

header "POSTGRESQL — DATABASES"
sudo -u postgres psql -c "\l+" 2>/dev/null | head -30

header "POSTGRESQL — USERS"
sudo -u postgres psql -c "\du" 2>/dev/null

header "CERTIFICATS SSL (certbot)"
sudo certbot certificates 2>/dev/null | grep -E "Certificate Name|Domains|Expiry Date|VALID"

header "CRON JOBS (deploy user)"
crontab -l 2>/dev/null || echo "Aucun cron"
echo
echo "Cron root :"
sudo crontab -l 2>/dev/null || echo "Aucun cron root"

header "APPS DÉPLOYÉES"
if [ -d /home/deploy/apps ]; then
  for app in /home/deploy/apps/*/; do
    name=$(basename "$app")
    cd "$app" 2>/dev/null
    branch=$(git branch --show-current 2>/dev/null || echo N/A)
    commit=$(git rev-parse --short HEAD 2>/dev/null || echo N/A)
    size=$(du -sh "$app" 2>/dev/null | cut -f1)
    echo "$name — branch: $branch | commit: $commit | taille: $size"
  done
else
  echo "Dossier /home/deploy/apps inexistant"
fi

header "BACKUPS DB (7 derniers)"
if [ -d /home/deploy/backups ]; then
  ls -lh /home/deploy/backups/*.sql.gz 2>/dev/null | tail -7 | awk '{print $9, "-", $5, "-", $6, $7, $8}'
  echo
  total=$(du -sh /home/deploy/backups 2>/dev/null | cut -f1)
  echo "Total du dossier : $total"
else
  echo "Dossier /home/deploy/backups inexistant"
fi

header "DISK USAGE (top 10 dossiers /home)"
sudo du -h --max-depth=2 /home 2>/dev/null | sort -hr | head -10

header "LOGS D'ERREUR RÉCENTS"
echo "── nginx (10 dernières lignes) ──"
sudo tail -10 /var/log/nginx/error.log 2>/dev/null || echo "Vide"
echo
echo "── auth.log (SSH — 5 dernières) ──"
sudo tail -5 /var/log/auth.log 2>/dev/null | grep -E "sshd|sudo" || echo "Vide"
echo
echo "── PM2 error log ──"
for logfile in /home/deploy/.pm2/logs/*-error.log; do
  if [ -f "$logfile" ]; then
    echo "── $(basename $logfile) ──"
    tail -10 "$logfile"
  fi
done

header "FIN DU RAPPORT"
echo "Généré le : $(date -Iseconds)"
