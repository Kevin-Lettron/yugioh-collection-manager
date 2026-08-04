/**
 * Bloc 5 · §5 · Traduction FR des libellés d'effets EDOPro via Claude Haiku.
 *
 *     npx ts-node scripts/backfillHintStringsFr.ts
 *     npx ts-node scripts/backfillHintStringsFr.ts --limit=50   # test bref
 *     npx ts-node scripts/backfillHintStringsFr.ts --resume     # reprise
 *
 * Les miroirs publics testés (Fluorohydride, mycard/ygopro) renvoient un
 * `strings.conf` en **chinois** ou en anglais. Notre plan §5 : partir d'un
 * fichier EN officiel et backfiller la traduction FR, comme on l'a fait pour
 * les news RSS (cf. `services/news/translate.ts`).
 *
 * Le fichier attendu en entrée est `server/assets/duel/strings.conf` (EN) —
 * à récupérer via `npm run duel:assets` ou en copiant `config/strings.conf`
 * du zip EDOPro. Sortie : `server/assets/duel/strings-fr.conf`, chargé
 * en priorité par `hintStrings.ts` au démarrage.
 *
 * Batch de 20 lignes par appel Haiku pour tenir dans le budget tokens sans
 * multiplier les appels. Idempotent : `--resume` reprend là où il s'était
 * arrêté (compare les clés déjà traduites).
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { DUEL_ASSETS_DIR } from '../src/services/duelEngine/paths';

const SRC = path.join(DUEL_ASSETS_DIR, 'strings.conf');
const DST = path.join(DUEL_ASSETS_DIR, 'strings-fr.conf');
const MODEL = process.env.CLAUDE_TRANSLATE_MODEL || 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 20;
const MAX_TOKENS = 2000;

interface ConfLine {
  cmd: string; // 'system', 'counter', 'setname', 'victory'
  key: number;
  keyRaw: string; // "1234" ou "0x1a" — conservé pour ré-écrire à l'identique
  value: string;
}

function parseConf(text: string): ConfLine[] {
  const out: ConfLine[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.startsWith('!')) continue;
    const spaceA = line.indexOf(' ');
    if (spaceA < 0) continue;
    const cmd = line.slice(1, spaceA);
    const rest = line.slice(spaceA + 1).trimStart();
    const spaceB = rest.indexOf(' ');
    if (spaceB < 0) continue;
    const keyRaw = rest.slice(0, spaceB);
    const value = rest.slice(spaceB + 1).trim();
    if (!value) continue;
    const key = keyRaw.startsWith('0x') ? parseInt(keyRaw.slice(2), 16) : parseInt(keyRaw, 10);
    if (!Number.isFinite(key)) continue;
    if (cmd !== 'system' && cmd !== 'counter' && cmd !== 'setname' && cmd !== 'victory') continue;
    out.push({ cmd, key, keyRaw, value });
  }
  return out;
}

function serializeConf(lines: ConfLine[]): string {
  return lines.map((l) => `!${l.cmd} ${l.keyRaw} ${l.value}`).join('\n') + '\n';
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey?.trim()) throw new Error('CLAUDE_API_KEY absente dans server/.env');
    client = new Anthropic({ apiKey });
  }
  return client;
}

const SYSTEM_PROMPT = `Tu traduis en français des libellés d'interface pour un client Yu-Gi-Oh (moteur ygopro-core / EDOPro).
Contexte :
- Ces textes s'affichent dans un client de duel, souvent en modal ou en bandeau.
- Ce sont des invites de sélection, des noms d'effet, des noms de marqueur, des noms d'archétype.
- Longueur : la plupart font moins de 100 caractères — reste concis.
- Vocabulaire : garde les termes officiels Konami TCG France quand tu les connais (Invocation Spéciale, Phase Principale, Cimetière, Bannir, Défausser, Cible, Chaîne, Effet, Contre-effet, Marqueur, Compteur...).
- Ne traduis JAMAIS les noms propres de cartes anglais (ex: Ash Blossom & Joyous Spring reste tel quel), sauf si tu es certain de la traduction officielle.
- Réponds UNIQUEMENT par un JSON strict : {"1234": "traduction FR", "5678": "traduction FR", ...}
- Aucun préambule, aucun commentaire, aucun markdown.`;

async function translateBatch(batch: ConfLine[]): Promise<Map<number, string>> {
  const input: Record<string, string> = {};
  for (const l of batch) input[String(l.key)] = l.value;

  const resp = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Traduis ces libellés (clé numérique → texte anglais) :\n${JSON.stringify(input, null, 2)}`,
      },
    ],
  });

  const block = resp.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') return new Map();
  const raw = block.text.trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return new Map();

  const out = new Map<number, string>();
  try {
    const parsed = JSON.parse(match[0]) as Record<string, string>;
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(k);
      if (Number.isFinite(n) && typeof v === 'string' && v.trim()) {
        out.set(n, v.trim());
      }
    }
  } catch {
    /* parse failed — on n'ajoute rien plutôt que d'insérer du bruit */
  }
  return out;
}

async function main(): Promise<void> {
  if (!fs.existsSync(SRC)) {
    console.error(`[strings-fr] ${SRC} introuvable — récupère d'abord un strings.conf EN.`);
    console.error('Sources possibles :');
    console.error('  - télécharger EDOPro depuis https://github.com/edo9300/edopro/releases');
    console.error('    puis copier config/strings.conf dans server/assets/duel/');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? Math.max(1, Number(limitArg)) : Infinity;
  const resume = args.includes('--resume');

  const src = parseConf(fs.readFileSync(SRC, 'utf8'));
  console.log(`[strings-fr] ${src.length} lignes chargées depuis ${SRC}`);

  // Reprise : on relit strings-fr.conf existant, on ne re-traduit pas les
  // clés déjà présentes.
  const alreadyDone = new Map<string, string>();
  if (resume && fs.existsSync(DST)) {
    for (const l of parseConf(fs.readFileSync(DST, 'utf8'))) {
      alreadyDone.set(`${l.cmd}:${l.key}`, l.value);
    }
    console.log(`[strings-fr] --resume : ${alreadyDone.size} clé(s) déjà traduites`);
  }

  const todo = src.filter((l) => !alreadyDone.has(`${l.cmd}:${l.key}`)).slice(0, limit);
  console.log(`[strings-fr] ${todo.length} lignes à traduire (batch ${BATCH_SIZE})`);

  // Groupe les batches par type pour donner un contexte homogène au modèle.
  const byCmd = new Map<string, ConfLine[]>();
  for (const l of todo) {
    const bucket = byCmd.get(l.cmd) ?? [];
    bucket.push(l);
    byCmd.set(l.cmd, bucket);
  }

  const translated = new Map<string, string>();
  for (const [k, v] of alreadyDone) translated.set(k, v);

  let done = 0;
  for (const [cmd, lines] of byCmd) {
    console.log(`\n[strings-fr] ${cmd} : ${lines.length} lignes`);
    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
      const batch = lines.slice(i, i + BATCH_SIZE);
      try {
        const result = await translateBatch(batch);
        for (const l of batch) {
          const t = result.get(l.key);
          if (t) translated.set(`${l.cmd}:${l.key}`, t);
        }
        done += batch.length;
        console.log(`  batch ${Math.floor(i / BATCH_SIZE) + 1} — ${done}/${todo.length} traduites`);
        // Écriture incrémentale : si le processus casse à mi-chemin, on garde
        // ce qui a été traduit jusque-là. `--resume` reprend proprement.
        writeOutput(src, translated);
      } catch (err) {
        console.error(
          `[strings-fr] batch échoué (${batch.length} lignes) : ${
            err instanceof Error ? err.message : err
          }`
        );
        // Écriture même en cas d'échec pour garder la progression.
        writeOutput(src, translated);
      }
    }
  }

  writeOutput(src, translated);
  console.log(`\n[strings-fr] terminé — ${translated.size} lignes dans ${DST}`);
}

function writeOutput(src: ConfLine[], translated: Map<string, string>): void {
  const outLines: ConfLine[] = [];
  for (const l of src) {
    const t = translated.get(`${l.cmd}:${l.key}`);
    if (t) outLines.push({ ...l, value: t });
  }
  const header = `# strings.conf FR — généré par scripts/backfillHintStringsFr.ts\n# ${new Date().toISOString()}\n# ${outLines.length}/${src.length} lignes traduites\n\n`;
  fs.writeFileSync(DST, header + serializeConf(outLines), 'utf8');
}

main().catch((err) => {
  console.error('[strings-fr] erreur inattendue :', err instanceof Error ? err.stack : err);
  process.exit(1);
});
