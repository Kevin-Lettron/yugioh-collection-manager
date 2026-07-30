# Générer un APK Android

Build cloud gratuit via EAS (pas besoin d'Android Studio installé sur ton PC).

## Prérequis (une seule fois)

1. **Créer un compte Expo gratuit** : https://expo.dev/signup
   - Email + mot de passe, pas de carte bancaire
   - 30 builds cloud offerts par mois sur le plan Free

## Générer l'APK (à chaque nouvelle version)

Dans un terminal PowerShell, depuis `C:\laragon\www\New-YugiohCollection\mobile` :

```powershell
npx eas login
```
→ Rentre l'email + mot de passe de ton compte Expo.

```powershell
npx eas build --profile preview --platform android
```

**Questions posées la première fois :**

- *"Would you like to automatically create an EAS project for @ton_username/yugioh-collection?"* → **Yes**
- *"Generate a new Android Keystore?"* → **Yes** (EAS stocke la keystore de façon sécurisée, tu n'as rien à gérer)

Le build lance dans le cloud. Ça prend **10-25 minutes**. Tu peux fermer le terminal, tu recevras un email quand c'est prêt, ou consulter le lien affiché.

## Installer l'APK sur ton téléphone

Quand le build est fini, EAS affiche (et t'envoie par email) un lien de téléchargement du type :
```
https://expo.dev/artifacts/eas/xxxxxxxx.apk
```

**Sur ton téléphone Android :**

1. Ouvre le lien dans le navigateur du tel → l'APK se télécharge
2. Ouvre le fichier téléchargé (via la notif ou l'app Fichiers)
3. Android va demander l'autorisation d'installer depuis une source inconnue :
   - Paramètres → Sécurité → Sources inconnues → Autoriser pour Chrome (ou l'app Fichiers)
4. Retour au fichier → **Installer**
5. L'app "YuGiOh Collection" apparaît dans ton launcher

## Mise à jour de l'app

À chaque nouvelle version :

1. Modifier `version` dans [`app.json`](app.json) (ex : `"1.0.0"` → `"1.0.1"`)
2. Relancer `npx eas build --profile preview --platform android`
3. Télécharger + installer le nouveau APK — Android va proposer de mettre à jour l'app existante

## Deux profils disponibles

- **`preview`** — APK signé pour tests internes, à sideload → à utiliser pour toi
- **`production`** — AAB (Android App Bundle) pour publication sur Google Play Store → à utiliser plus tard si tu passes sur le Play Store (compte dev 25 $ à vie requis)

Voir [`eas.json`](eas.json) pour les configs détaillées.

## Debug si problème

- **`eas login` demande TOTP mais tu n'as pas configuré 2FA** → il te propose "One-time password sent to your email"
- **Build échoue avec `Missing keystore`** → laisser EAS générer la keystore (répondre Yes)
- **Build échoue avec erreurs JS/TS** → lance `npx tsc --noEmit` en local pour reproduire, corrige, recommence
- **APK crash au boot après install** → vérifie que tu es bien sur SDK 54 (voir [`package.json`](package.json)), pas SDK 57
