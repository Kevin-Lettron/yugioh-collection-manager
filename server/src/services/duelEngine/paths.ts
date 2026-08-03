import path from 'path';
import fs from 'fs';

/**
 * Emplacement des données du moteur de duel.
 *
 * `__dirname` change entre le source et le build : `rootDir: ".."` fait nicher
 * la sortie dans `dist/server/src/…`, un `../..` en dur casserait donc dans un
 * des deux cas. On remonte jusqu'au dossier qui contient `assets/duel`.
 */
function findAssetsRoot(): string {
  const envPath = process.env.DUEL_ASSETS_DIR;
  if (envPath) return path.resolve(envPath);

  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'assets', 'duel');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Rien trouvé : on renvoie le chemin attendu depuis la racine du paquet
  // serveur pour que le message d'erreur d'appelant soit exploitable.
  return path.resolve(__dirname, '..', '..', '..', 'assets', 'duel');
}

export const DUEL_ASSETS_DIR = findAssetsRoot();
export const CARD_DB_PATH = path.join(DUEL_ASSETS_DIR, 'cards.cdb');
export const SCRIPTS_DIR = path.join(DUEL_ASSETS_DIR, 'scripts');

/** Message unique, pour ne pas répéter l'invite d'installation partout. */
export const MISSING_ASSETS_HINT =
  'Données du moteur absentes. Lancer : npx ts-node scripts/fetchDuelAssets.ts';

export function assetsInstalled(): boolean {
  return fs.existsSync(CARD_DB_PATH) && fs.existsSync(path.join(SCRIPTS_DIR, 'constant.lua'));
}
