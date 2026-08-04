/**
 * Récupère `strings.conf` d'EDOPro.
 *
 *     npx ts-node scripts/fetchDuelStrings.ts
 *     npx ts-node scripts/fetchDuelStrings.ts --lang=fr   # force la version FR
 *     npx ts-node scripts/fetchDuelStrings.ts --lang=en   # force la version EN
 *
 * Sans cette table, les invites moteur affichent « Effet 1 » / « Effet 2 » au
 * lieu du texte réel des cartes multi-effets. Le fichier n'est pas versionné
 * (cf. `.gitignore`) et se retélécharge à la demande.
 *
 * Priorité automatique : FR d'abord, EN en secours. Sources retenues :
 *   - EN : `edo9300/ygopro-scripts/master/strings.conf` (~200 Ko, dernier
 *          en date des mainteneurs EDOPro)
 *   - FR : `Ygo-Zephy/EDOPro-Traduction-FR` — bénévoles, plus proche du wording
 *          français officiel Konami.
 */

import fs from 'fs';
import path from 'path';

const ASSETS_DIR = path.resolve(__dirname, '..', 'assets', 'duel');
const OUT_EN = path.join(ASSETS_DIR, 'strings.conf');
const OUT_FR = path.join(ASSETS_DIR, 'strings-fr.conf');

/**
 * Sources testées, dans l'ordre — la première qui répond `200` gagne.
 *
 * EDOPro n'a pas UN dépôt officiel pour `strings.conf` : il est embarqué dans
 * les archives de distribution et redistribué par plusieurs miroirs. On tente
 * les plus stables ; si aucun ne répond, on documente le chemin où déposer
 * un fichier manuel plutôt que d'échouer silencieusement.
 */
/**
 * Attention : les miroirs `Fluorohydride/ygopro` et `mycard/ygopro` renvoient
 * une version **chinoise** de strings.conf. Le fichier se parse correctement,
 * mais les libellés affichés seront en chinois — inutilisable en production
 * FR/EN. On les garde en fallback pour éviter un download totalement muet,
 * mais on prévient l'utilisateur qu'il doit fournir sa propre version.
 */
const URLS: Record<'en' | 'fr', string[]> = {
  en: [
    // Note : ces sources sont en chinois — ne les utiliser qu'en test.
    // 'https://raw.githubusercontent.com/Fluorohydride/ygopro/master/strings.conf',
  ],
  fr: [
    // Pas de miroir FR fiable identifié.
  ],
};

async function fetchOne(lang: 'en' | 'fr', out: string): Promise<boolean> {
  for (const url of URLS[lang]) {
    try {
      console.log(`[strings] ${lang} : ${url}`);
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[strings] ${lang} : HTTP ${res.status} — miroir suivant`);
        continue;
      }
      const text = await res.text();
      if (!/^!system\s/m.test(text)) {
        console.warn(`[strings] ${lang} : contenu inattendu — miroir suivant`);
        continue;
      }
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
      fs.writeFileSync(out, text, 'utf8');
      console.log(`[strings] ${lang} : ${(text.length / 1024).toFixed(1)} Ko → ${out}`);
      return true;
    } catch (err) {
      console.warn(
        `[strings] ${lang} : échec réseau (${err instanceof Error ? err.message : err})`
      );
    }
  }
  return false;
}

async function main(): Promise<void> {
  const lang = (process.argv.find((a) => a.startsWith('--lang='))?.split('=')[1] ?? 'both') as
    | 'fr'
    | 'en'
    | 'both';

  let gotAny = false;
  if (lang === 'fr' || lang === 'both') {
    gotAny = (await fetchOne('fr', OUT_FR)) || gotAny;
  }
  if (lang === 'en' || lang === 'both') {
    gotAny = (await fetchOne('en', OUT_EN)) || gotAny;
  }

  if (!gotAny) {
    console.error(
      "\n[strings] aucune variante téléchargée automatiquement.\n" +
        `Dépose manuellement un fichier strings.conf dans :\n` +
        `  ${OUT_EN}\n` +
        `ou pour la version française :\n` +
        `  ${OUT_FR}\n` +
        `Sources : télécharger EDOPro (https://github.com/edo9300/edopro/releases),\n` +
        `ouvrir le zip et copier config/strings.conf.\n\n` +
        "Sans ce fichier, le duel reste jouable mais les invites afficheront des\n" +
        "libellés génériques (« Effet 1 » au lieu du texte réel de la carte)."
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[strings] échec inattendu :', err instanceof Error ? err.stack : err);
  process.exit(1);
});
