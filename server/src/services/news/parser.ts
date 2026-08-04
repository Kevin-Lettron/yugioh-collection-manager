import { XMLParser } from 'fast-xml-parser';
import type { RawNewsItem } from './types';

/**
 * Analyse d'un flux, RSS 2.0 **ou** Atom.
 *
 * Les deux formats ne se ressemblent que de loin : `<item>` contre `<entry>`,
 * `<pubDate>` contre `<updated>`, `<description>` contre `<summary>` ou
 * `<content>`, et le lien qui est un texte d'un côté, un attribut `href` de
 * l'autre. Reddit sert de l'Atom, YGOrganization du RSS : il faut les deux.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  // Sans ça, un flux à un seul article rend un objet là où le code attend un
  // tableau — et le premier article de la journée passe à la trappe.
  isArray: (name) => ['item', 'entry', 'category', 'link'].includes(name),
  trimValues: true,
  processEntities: true,
});

type Node = Record<string, unknown>;

const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

/** Rend le texte d'un nœud, qu'il soit une chaîne ou un objet à `#text`. */
function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const t = (value as Node)['#text'];
    if (typeof t === 'string') return t.trim() || null;
    if (typeof t === 'number') return String(t);
  }
  return null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  ccedil: 'ç',
  laquo: '«',
  raquo: '»',
};

/**
 * Décode les entités HTML.
 *
 * Indispensable, et pas seulement pour les résumés : les **titres** des flux en
 * sont truffés. YGOrganization sert `&#8220;Endymion&#8221;` là où il faut lire
 * « Endymion » — sans ce décodage, les guillemets typographiques s'affichent en
 * clair dans l'interface. `processEntities` de l'analyseur XML ne traite que les
 * cinq entités XML ; les entités HTML numériques passent au travers.
 */
export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

/** Retire le balisage d'un résumé et le raccourcit. Les flux servent du HTML. */
export function plainSummary(html: string | null, maxLength = 400): string | null {
  if (!html) return null;
  const stripped = decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();

  if (!stripped) return null;
  if (stripped.length <= maxLength) return stripped;
  // Coupe sur un espace : tronquer au milieu d'un mot se voit.
  const cut = stripped.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
}

/** Première image trouvée dans le contenu HTML, à défaut de vignette déclarée. */
function firstImage(html: string | null): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function parseDate(...candidates: unknown[]): Date | null {
  for (const candidate of candidates) {
    const raw = text(candidate);
    if (!raw) continue;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function rssItem(node: Node): RawNewsItem | null {
  const url = text(node.link) ?? text(node.guid);
  const title = text(node.title);
  if (!url || !title) return null;

  const contentEncoded = text(node['content:encoded']);
  const description = text(node.description);

  // `isPermaLink="false"` est fréquent : le guid est alors un identifiant
  // opaque, pas une URL. Dans les deux cas il fait une clé de déduplication.
  const guid = text(node.guid) ?? url;

  const published =
    parseDate(node.pubDate, node['dc:date'], node.date) ?? new Date();

  const media = node['media:content'] as Node | undefined;
  const enclosure = node.enclosure as Node | undefined;

  return {
    guid,
    url,
    title: decodeEntities(title),
    summary: plainSummary(description ?? contentEncoded),
    imageUrl:
      (media?.['@url'] as string | undefined) ??
      (enclosure?.['@url'] as string | undefined) ??
      firstImage(contentEncoded ?? description),
    publishedAt: published,
    categories: asArray(node.category as unknown[])
      .map((c) => { const t = text(c); return t ? decodeEntities(t) : null; })
      .filter((c): c is string => !!c),
  };
}

function atomEntry(node: Node): RawNewsItem | null {
  // Un lien Atom est un attribut, et il peut y en avoir plusieurs : celui qui
  // nous intéresse est `rel="alternate"`, ou le premier à défaut.
  const links = asArray(node.link as Node[]);
  const alternate =
    links.find((l) => (l['@rel'] ?? 'alternate') === 'alternate') ?? links[0];
  const url = (alternate?.['@href'] as string | undefined) ?? text(node.id);

  const title = text(node.title);
  if (!url || !title) return null;

  const content = text(node.content) ?? text(node.summary);
  const published = parseDate(node.published, node.updated) ?? new Date();

  return {
    guid: text(node.id) ?? url,
    url,
    title: decodeEntities(title),
    summary: plainSummary(content),
    imageUrl: firstImage(content),
    publishedAt: published,
    categories: asArray(node.category as Node[])
      .map((c) => (c['@term'] as string | undefined) ?? text(c))
      .filter((c): c is string => !!c),
  };
}

export function parseFeed(xml: string): RawNewsItem[] {
  const doc = parser.parse(xml) as Node;

  const rss = doc.rss as Node | undefined;
  if (rss) {
    const channel = rss.channel as Node | undefined;
    const items = asArray(channel?.item as Node[]);
    return items.map(rssItem).filter((i): i is RawNewsItem => i !== null);
  }

  const feed = doc.feed as Node | undefined;
  if (feed) {
    const entries = asArray(feed.entry as Node[]);
    return entries.map(atomEntry).filter((i): i is RawNewsItem => i !== null);
  }

  // Certains flux RSS 1.0 (RDF) posent les items à la racine.
  const rdf = doc['rdf:RDF'] as Node | undefined;
  if (rdf) {
    const items = asArray(rdf.item as Node[]);
    return items.map(rssItem).filter((i): i is RawNewsItem => i !== null);
  }

  throw new Error('format de flux non reconnu (ni RSS, ni Atom, ni RDF)');
}
