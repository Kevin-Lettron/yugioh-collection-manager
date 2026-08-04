/**
 * Traduction FR des articles d'actualites via Claude Haiku.
 *
 * Les flux RSS sont en anglais (aucun flux Yu-Gi-Oh francais fiable).
 * On traduit titre + resume au moment de l'ingest et on cache en DB.
 * Coup estime : ~$1/mois pour ~1300 articles.
 *
 * Le modele Haiku est utilise (rapide, pas cher, qualite suffisante pour
 * une trad de titre + resume court). On demande une reponse JSON stricte
 * pour parser sans risque.
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../../config/database';
import logger from '../../utils/logger';

const MODEL = process.env.CLAUDE_TRANSLATE_MODEL || 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 800;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey?.trim()) {
      throw new Error('CLAUDE_API_KEY absente dans server/.env');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

const SYSTEM_PROMPT = `Tu traduis en francais des titres et resumes d'articles Yu-Gi-Oh (TCG competitif).
Consignes :
- Traduis fidelement, garde le ton et le vocabulaire du jeu (banlist, deck, meta, YCS, OCG, TCG restent en anglais)
- Noms propres de cartes : garde les traductions officielles Konami TCG France quand tu les connais (Dragon Blanc aux Yeux Bleus, Magicien Sombre, etc.) sinon garde l'anglais entre guillemets
- Reste concis, pas d'ajout d'info
- Reponds UNIQUEMENT en JSON strict : {"title_fr": "...", "summary_fr": "..." | null}
- Si le resume est null ou vide, mets "summary_fr": null`;

interface TranslationResult {
  title_fr: string;
  summary_fr: string | null;
}

/** Traduit un article via Claude. Retourne null si echec (parse ou API). */
async function translateOne(title: string, summary: string | null): Promise<TranslationResult | null> {
  try {
    const userPayload = JSON.stringify({ title, summary });
    const resp = await getClient().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Article a traduire :\n${userPayload}` }],
    });

    const block = resp.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') return null;

    // Extrait le premier JSON du texte (Claude peut mettre du markdown autour).
    const raw = block.text.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as Partial<TranslationResult>;
    if (typeof parsed.title_fr !== 'string' || !parsed.title_fr.trim()) return null;

    return {
      title_fr: parsed.title_fr.trim(),
      summary_fr: typeof parsed.summary_fr === 'string' ? parsed.summary_fr.trim() : null,
    };
  } catch (err) {
    logger.warn('News translate failed', {
      titleSample: title.slice(0, 60),
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Traduit et sauve en DB un batch de N articles pas encore traduits.
 * Sequentiel avec pause 400ms entre appels (respect rate limits Anthropic).
 * Retourne le count des traductions reussies.
 */
export async function translatePendingArticles(limit: number = 30): Promise<{ ok: number; ko: number }> {
  const res = await query(
    `SELECT id, title, summary FROM news_items
     WHERE title_fr IS NULL
     ORDER BY published_at DESC
     LIMIT $1`,
    [limit]
  );

  let ok = 0;
  let ko = 0;

  for (const row of res.rows) {
    const trad = await translateOne(row.title, row.summary);
    if (trad) {
      await query(
        `UPDATE news_items
         SET title_fr = $1, summary_fr = $2, translated_at = NOW(), lang = 'fr'
         WHERE id = $3`,
        [trad.title_fr, trad.summary_fr, row.id]
      );
      ok++;
    } else {
      // On marque translated_at pour ne pas reboucler indefiniment sur un article
      // qui echoue de facon systematique (JSON malforme, contenu bizarre...).
      await query(
        `UPDATE news_items SET translated_at = NOW() WHERE id = $1`,
        [row.id]
      );
      ko++;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  if (ok + ko > 0) {
    logger.info('News translation batch', { ok, ko, total: ok + ko });
  }
  return { ok, ko };
}
