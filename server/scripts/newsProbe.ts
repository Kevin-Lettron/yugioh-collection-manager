/**
 * Étape 1 du plan Actualités — vérifie que les flux répondent et qu'on sait les
 * lire.
 *
 *     npx ts-node scripts/newsProbe.ts
 *
 * Ne touche pas à PostgreSQL : il appelle les flux, les analyse, et affiche ce
 * qu'ils donnent vraiment. Si une source change de format ou se met à refuser
 * notre robot, c'est ici que ça se voit — avant que le fil ne se vide en
 * silence en production.
 */

import { fetchFeed } from '../src/services/news/fetcher';
import { parseFeed } from '../src/services/news/parser';

interface Probe {
  key: string;
  name: string;
  url: string;
}

/** Mêmes sources que la migration 007 — cf. docs/PLAN-ACTUALITES.md. */
const SOURCES: Probe[] = [
  { key: 'ygorganization', name: 'YGOrganization', url: 'https://ygorganization.com/feed/' },
  { key: 'pojo', name: 'Pojo', url: 'https://www.pojo.com/feed/' },
  { key: 'reddit_yugioh', name: 'Reddit r/yugioh', url: 'https://www.reddit.com/r/yugioh/.rss' },
];

const short = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);

async function probe(source: Probe): Promise<boolean> {
  process.stdout.write(`\n══ ${source.name} — ${source.url}\n`);
  try {
    const { body, contentType } = await fetchFeed(source.url);
    const items = parseFeed(body);

    console.log(`   ${items.length} article(s) · ${Math.round(body.length / 1024)} Ko · ${contentType ?? 'type inconnu'}`);

    if (items.length === 0) {
      console.log('   ⚠ flux lisible mais vide — format inattendu ?');
      return false;
    }

    const categories = new Map<string, number>();
    let withSummary = 0;
    let withImage = 0;

    for (const item of items) {
      if (item.summary) withSummary++;
      if (item.imageUrl) withImage++;
      for (const c of item.categories) categories.set(c, (categories.get(c) ?? 0) + 1);
    }

    console.log(`   résumé : ${withSummary}/${items.length} · image : ${withImage}/${items.length}`);

    if (categories.size) {
      const top = [...categories.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([c, n]) => `${c} (${n})`)
        .join(', ');
      console.log(`   catégories : ${top}`);
    } else {
      console.log('   catégories : aucune — la classification devra se faire aux mots-clés');
    }

    console.log('   ── trois derniers ──');
    for (const item of items.slice(0, 3)) {
      const date = item.publishedAt.toISOString().slice(0, 10);
      console.log(`   ${date}  ${short(item.title, 68)}`);
    }

    return true;
  } catch (err) {
    console.log(`   ✗ ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function main(): Promise<void> {
  let ok = 0;

  for (const source of SOURCES) {
    if (await probe(source)) ok++;
    // Politesse : on ne rafale pas trois requêtes d'affilée, surtout vers
    // Reddit qui répond 429 au deuxième appel rapproché.
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n${ok}/${SOURCES.length} source(s) exploitable(s)`);
  process.exit(ok === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[erreur]', err instanceof Error ? err.stack : err);
  process.exit(1);
});
