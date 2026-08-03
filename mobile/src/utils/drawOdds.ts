/**
 * Probabilités de pioche — loi hypergéométrique.
 *
 * Copie de client/src/utils/drawOdds.ts : le mobile ne peut pas importer hors
 * de son package (cf. l'en-tête de src/types.ts). Toute correction ici doit
 * être répercutée là-bas.
 *
 * On tire sans remise dans un paquet fini : c'est exactement le cadre de la
 * loi hypergéométrique, pas de la binomiale. Une carte en 3 exemplaires sur 40
 * n'a pas 3/40 de chance d'être piochée en 5 cartes, mais 33,8 %.
 */

/**
 * Coefficients binomiaux en logarithmes.
 *
 * C(60, 15) vaut 5,3 × 10¹³ : ça tient dans un `number`, mais le produit de
 * plusieurs coefficients (probabilité d'une main complète) déborde vite. Passer
 * par les logarithmes évite l'infini et les pertes de précision.
 */
const logFactorialCache: number[] = [0, 0];

function logFactorial(n: number): number {
  if (n < 0) return NaN;
  for (let i = logFactorialCache.length; i <= n; i++) {
    logFactorialCache[i] = logFactorialCache[i - 1] + Math.log(i);
  }
  return logFactorialCache[n];
}

function logBinomial(n: number, k: number): number {
  if (k < 0 || k > n || n < 0) return -Infinity;
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

/**
 * Probabilité de piocher **au moins un** exemplaire d'une carte.
 *
 * @param copies      exemplaires restants dans la pioche
 * @param deckSize    cartes restantes dans la pioche
 * @param draws       nombre de cartes piochées
 */
export function atLeastOne(copies: number, deckSize: number, draws: number): number {
  if (copies <= 0 || deckSize <= 0 || draws <= 0) return 0;
  if (draws >= deckSize) return 1;
  if (copies >= deckSize) return 1;

  // P(aucun) = C(deckSize - copies, draws) / C(deckSize, draws)
  const logNone = logBinomial(deckSize - copies, draws) - logBinomial(deckSize, draws);
  return 1 - Math.exp(logNone);
}

/**
 * Probabilité de piocher **exactement** `wanted` exemplaires.
 * Utile pour « quelle chance d'ouvrir avec les 2 copies ? ».
 */
export function exactly(
  copies: number,
  deckSize: number,
  draws: number,
  wanted: number
): number {
  if (wanted < 0 || wanted > copies || wanted > draws) return 0;
  if (deckSize <= 0 || draws > deckSize) return 0;

  const log =
    logBinomial(copies, wanted) +
    logBinomial(deckSize - copies, draws - wanted) -
    logBinomial(deckSize, draws);
  return Math.exp(log);
}

/**
 * Probabilité d'obtenir **exactement cette main**, à partir de la composition
 * initiale du deck.
 *
 * Loi hypergéométrique multivariée : le tirage est non ordonné, donc on compare
 * le nombre de mains identiques à celle-ci au nombre total de mains possibles.
 *
 *   P = ∏ C(copies_i, en_main_i) / C(taille_deck, taille_main)
 *
 * @param handCounts   pour chaque carte de la main : exemplaires tenus
 * @param deckCounts   pour chaque même carte : exemplaires dans le deck de départ
 * @param initialSize  taille du deck avant la première pioche
 */
export function handProbability(
  entries: { inHand: number; inDeck: number }[],
  initialSize: number
): number {
  const handSize = entries.reduce((sum, e) => sum + e.inHand, 0);
  if (handSize === 0 || initialSize <= 0 || handSize > initialSize) return 0;

  let log = -logBinomial(initialSize, handSize);
  for (const { inHand, inDeck } of entries) {
    if (inHand > inDeck) return 0; // main impossible avec ce deck
    log += logBinomial(inDeck, inHand);
  }
  return Math.exp(log);
}

/**
 * Formate une probabilité pour l'affichage.
 *
 * Les valeurs très faibles sont fréquentes sur une main complète (une ouverture
 * précise sur 40 cartes tourne autour de 1 chance sur 600 000). Un simple
 * arrondi à deux décimales afficherait « 0,00 % » et n'apprendrait rien, d'où
 * la bascule en notation « 1 sur N ».
 */
export function formatOdds(p: number): string {
  if (!isFinite(p) || p <= 0) return '0 %';
  if (p >= 0.9995) return '100 %';

  const pct = p * 100;
  if (pct >= 10) return `${pct.toFixed(1).replace('.', ',')} %`;
  if (pct >= 0.1) return `${pct.toFixed(2).replace('.', ',')} %`;

  const oneIn = Math.round(1 / p);
  return `1 sur ${oneIn.toLocaleString('fr-FR')}`;
}
