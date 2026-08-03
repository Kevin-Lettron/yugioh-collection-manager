import fs from 'fs';
import path from 'path';
import type { OcgCoreSync } from 'ocgcore-wasm';
import { SCRIPTS_DIR, MISSING_ASSETS_HINT, assetsInstalled } from './paths';

/**
 * Chargement du moteur WebAssembly depuis notre code CommonJS.
 *
 * `ocgcore-wasm` est publié en **ESM pur** (`"type": "module"`), et le serveur
 * compile en CommonJS. Un `import()` écrit tel quel serait transpilé en
 * `require()` par TypeScript, ce qui échoue sur un paquet ESM. L'indirection par
 * `new Function` empêche cette réécriture : le `import()` reste natif à
 * l'exécution.
 *
 * C'est le seul endroit du serveur qui touche à cette bizarrerie ; tout le reste
 * passe par `getCore()`.
 */
const importEsm = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<typeof import('ocgcore-wasm')>;

let corePromise: Promise<OcgCoreSync> | null = null;
let moduleCache: typeof import('ocgcore-wasm') | null = null;

/** Le module ESM lui-même — nécessaire pour ses énumérations, qui sont des valeurs. */
export async function getOcgModule(): Promise<typeof import('ocgcore-wasm')> {
  if (!moduleCache) {
    moduleCache = await importEsm('ocgcore-wasm');
  }
  return moduleCache;
}

/**
 * Instance du moteur, partagée par tous les duels.
 *
 * Version **synchrone** : l'alternative asynchrone exige JSPI, donc le drapeau
 * `--experimental-wasm-stack-switching` au lancement de Node. On ne conditionne
 * pas le démarrage de l'API à un drapeau expérimental.
 */
export async function getCore(): Promise<OcgCoreSync> {
  if (!corePromise) {
    corePromise = getOcgModule().then((mod) => mod.default({ sync: true }));
  }
  return corePromise;
}

/**
 * Lecteur de scripts Lua passé au moteur.
 *
 * Le moteur demande ses scripts par nom : `c12345678.lua` pour une carte,
 * n'importe quel autre nom pour une procédure partagée. Les premiers vivent dans
 * `official/`, les seconds à la racine — c'est la convention de Project Ignis.
 *
 * Les scripts sont mis en cache : une partie en charge des centaines et les
 * mêmes reviennent d'un duel à l'autre.
 */
export function createScriptReader(): (name: string) => string | null {
  const cache = new Map<string, string | null>();

  return (name: string): string | null => {
    const cached = cache.get(name);
    if (cached !== undefined) return cached;

    const isCardScript = /^c\d+\.lua$/.test(name);
    const filePath = isCardScript
      ? path.join(SCRIPTS_DIR, 'official', name)
      : path.join(SCRIPTS_DIR, name);

    let content: string | null = null;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      // Une carte sans script est normale : les monstres Normaux n'en ont pas.
      // Renvoyer null est la réponse attendue, pas une erreur.
      content = null;
    }

    cache.set(name, content);
    return content;
  };
}

/**
 * Scripts que l'hôte doit injecter lui-même avant `startDuel`.
 *
 * Le moteur ne les réclame pas via `scriptReader` : c'est à l'hôte de les
 * pousser, comme le fait EDOPro. Sans eux, le premier script de carte échoue sur
 * des constantes indéfinies.
 */
export const BOOTSTRAP_SCRIPTS = ['constant.lua', 'utility.lua'] as const;

export function readBootstrapScript(name: string): string {
  if (!assetsInstalled()) throw new Error(MISSING_ASSETS_HINT);
  return fs.readFileSync(path.join(SCRIPTS_DIR, name), 'utf8');
}
