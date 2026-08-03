import { useMemo, useState } from 'react';
import { DeckCard } from '../../../shared/types';
import { atLeastOne, handProbability, formatOdds } from '../utils/drawOdds';

const CUT_PANEL =
  'polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,0 100%)';

interface DrawOddsPanelProps {
  /** Composition initiale du Main Deck (avant la première pioche). */
  mainDeck: DeckCard[];
  /** Cartes encore dans la pioche — se vide au fil du test. */
  deckPile: DeckCard[];
  /** Main courante. */
  handCards: DeckCard[];
  /** true si une partie de test est en cours. */
  active: boolean;
}

interface Row {
  key: string;
  name: string;
  inDeckInitial: number;
  remaining: number;
  inHand: number;
  next1: number;
  next3: number;
  next5: number;
}

const nameOf = (dc: DeckCard): string =>
  dc.card?.name_fr || dc.card?.name || `Carte #${dc.card_id}`;

/**
 * Probabilités de pioche, recalculées à chaque changement d'état du test.
 *
 * Deux informations distinctes :
 *   - par carte, la chance de la piocher dans les prochains tirages, sur la
 *     pioche **restante** — c'est ce qui bouge à chaque pioche ;
 *   - pour la main courante, la probabilité d'être tombé exactement dessus,
 *     calculée sur la composition **initiale** du deck.
 */
export default function DrawOddsPanel({
  mainDeck,
  deckPile,
  handCards,
  active,
}: DrawOddsPanelProps) {
  const [sort, setSort] = useState<'odds' | 'name'>('odds');
  const [onlyRemaining, setOnlyRemaining] = useState(false);

  const initialSize = useMemo(
    () => mainDeck.reduce((sum, dc) => sum + dc.quantity, 0),
    [mainDeck]
  );

  const rows = useMemo<Row[]>(() => {
    // Les cartes sont regroupées par identifiant : la pioche manipule des
    // instances atomiques (une entrée par exemplaire), l'affichage veut une
    // ligne par carte.
    const countBy = (list: DeckCard[]) => {
      const m = new Map<number, number>();
      for (const dc of list) m.set(dc.card_id, (m.get(dc.card_id) || 0) + dc.quantity);
      return m;
    };

    const remainingBy = countBy(deckPile);
    const handBy = countBy(handCards);
    const pileSize = deckPile.reduce((s, dc) => s + dc.quantity, 0);

    const out = mainDeck.map<Row>((dc) => {
      const remaining = active ? remainingBy.get(dc.card_id) || 0 : dc.quantity;
      const pool = active ? pileSize : initialSize;
      return {
        key: String(dc.card_id),
        name: nameOf(dc),
        inDeckInitial: dc.quantity,
        remaining,
        inHand: handBy.get(dc.card_id) || 0,
        next1: atLeastOne(remaining, pool, 1),
        next3: atLeastOne(remaining, pool, 3),
        next5: atLeastOne(remaining, pool, 5),
      };
    });

    const filtered = onlyRemaining ? out.filter((r) => r.remaining > 0) : out;

    return filtered.sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name, 'fr') : b.next1 - a.next1 || a.name.localeCompare(b.name, 'fr')
    );
  }, [mainDeck, deckPile, handCards, active, initialSize, sort, onlyRemaining]);

  /** Probabilité d'avoir tiré exactement cette main depuis le deck de départ. */
  const currentHandOdds = useMemo(() => {
    if (!active || handCards.length === 0) return null;

    const initialBy = new Map<number, number>();
    for (const dc of mainDeck) initialBy.set(dc.card_id, (initialBy.get(dc.card_id) || 0) + dc.quantity);

    const handBy = new Map<number, number>();
    for (const dc of handCards) handBy.set(dc.card_id, (handBy.get(dc.card_id) || 0) + dc.quantity);

    const entries = [...handBy.entries()].map(([cardId, inHand]) => ({
      inHand,
      inDeck: initialBy.get(cardId) || 0,
    }));

    return handProbability(entries, initialSize);
  }, [active, handCards, mainDeck, initialSize]);

  const handSize = handCards.reduce((s, dc) => s + dc.quantity, 0);
  const pileSize = deckPile.reduce((s, dc) => s + dc.quantity, 0);

  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        clipPath: CUT_PANEL,
        padding: '18px 20px',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h3
          style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            margin: 0,
          }}>
          Probabilités de pioche
        </h3>
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        {active
          ? `Calculé sur les ${pileSize} cartes restantes — mis à jour à chaque pioche.`
          : `Calculé sur le deck complet (${initialSize} cartes). Lance un test pour suivre l'évolution.`}
      </p>

      {/* Probabilité de la main courante */}
      {currentHandOdds !== null && (
        <div
          style={{
            borderLeft: '2px solid var(--cyan)',
            background: 'color-mix(in srgb, var(--cyan) 8%, transparent)',
            padding: '10px 12px',
            marginBottom: 14,
          }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}>
            Cette main précise
          </div>
          <div
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--cyan)',
              marginTop: 2,
            }}>
            {formatOdds(currentHandOdds)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Chance de tirer exactement ces {handSize} cartes depuis un deck de {initialSize}.
            L'ordre ne compte pas.
          </div>
        </div>
      )}

      {/* Contrôles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setSort(sort === 'odds' ? 'name' : 'odds')}
          style={chipStyle(false)}>
          Tri : {sort === 'odds' ? 'probabilité' : 'nom'}
        </button>
        {active && (
          <button
            type="button"
            onClick={() => setOnlyRemaining((v) => !v)}
            style={chipStyle(onlyRemaining)}>
            {onlyRemaining ? '✓ ' : ''}Masquer les épuisées
          </button>
        )}
      </div>

      {/* Tableau */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle('left')}>Carte</th>
              <th style={thStyle('center')} title="Exemplaires restants dans la pioche">
                Reste
              </th>
              <th style={thStyle('right')} title="Probabilité de la piocher à la prochaine carte">
                +1
              </th>
              <th style={thStyle('right')} title="Probabilité de la voir dans les 3 prochaines">
                +3
              </th>
              <th style={thStyle('right')} title="Probabilité de la voir dans les 5 prochaines">
                +5
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const exhausted = active && r.remaining === 0;
              return (
                <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
                  <td
                    style={{
                      padding: '7px 8px 7px 0',
                      color: exhausted ? 'var(--text-dim)' : 'var(--text)',
                      textDecoration: exhausted ? 'line-through' : 'none',
                    }}>
                    {r.name}
                    {r.inHand > 0 && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--gold)',
                          letterSpacing: '0.08em',
                        }}>
                        EN MAIN ×{r.inHand}
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '7px 8px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                    {r.remaining}/{r.inDeckInitial}
                  </td>
                  <td style={tdOdds(r.next1, exhausted)}>{formatOdds(r.next1)}</td>
                  <td style={tdOdds(r.next3, exhausted)}>{formatOdds(r.next3)}</td>
                  <td style={tdOdds(r.next5, exhausted)}>{formatOdds(r.next5)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '10px 0 0' }}>
          Aucune carte à afficher.
        </p>
      )}
    </div>
  );
}

function chipStyle(activeChip: boolean): React.CSSProperties {
  return {
    padding: '5px 12px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    cursor: 'pointer',
    background: activeChip ? 'var(--gold)' : 'var(--panel-2)',
    color: activeChip ? 'var(--on-gold)' : 'var(--text-muted)',
    border: `1px solid ${activeChip ? 'var(--gold)' : 'var(--border)'}`,
    clipPath: 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)',
  };
}

function thStyle(align: 'left' | 'center' | 'right'): React.CSSProperties {
  return {
    textAlign: align,
    padding: '0 8px 8px 0',
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
}

function tdOdds(p: number, exhausted: boolean): React.CSSProperties {
  return {
    padding: '7px 0 7px 8px',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    // Gradation de lisibilité : une carte très probable ressort en or.
    color: exhausted ? 'var(--text-dim)' : p >= 0.5 ? 'var(--gold)' : p >= 0.2 ? 'var(--text)' : 'var(--text-muted)',
    whiteSpace: 'nowrap',
  };
}
