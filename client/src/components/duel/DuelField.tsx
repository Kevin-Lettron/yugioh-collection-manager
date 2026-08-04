import type {
  DuelBoardView,
  DuelCardView,
  DuelPromptOption,
  DuelZoneView,
} from '../../../../shared/duelView';

/**
 * Le plateau, à la disposition officielle.
 *
 * Sept colonnes par rangée, comme sur un tapis Konami :
 *
 *     [Terrain]  [Monstre ×5]      [Cimetière]
 *     [Extra]    [Magie/Piège ×5]  [Deck]
 *
 * et, entre les deux camps, les **deux Zones Monstre Supplémentaires** que se
 * partagent les joueurs — celles où atterrissent les monstres Lien et les
 * invocations depuis l'Extra Deck.
 *
 * Le camp adverse est le même plateau retourné : son Deck se retrouve donc à
 * gauche et son Cimetière à droite, exactement comme si on était assis en face.
 *
 * ── Indices exposés par le moteur ────────────────────────────────────────
 * `monsters` en compte 7 : 0 à 4 pour les zones principales, 5 et 6 pour les
 * Zones Monstre Supplémentaires. `spells` en compte 8 : 0 à 4 pour les
 * magies/pièges, **5 pour le Terrain**, 6 et 7 pour les zones Pendule des
 * anciennes Master Rules. C'est ce décalage qui fait que le Terrain n'est pas
 * là où on l'attendrait.
 */

/** Constantes d'emplacement du moteur, reprises pour cibler une zone. */
const LOCATION_MZONE = 0x4;
const LOCATION_SZONE = 0x8;

const ZONE_W = 62;
const ZONE_H = 90;
const GAP = 5;

const cardImage = (code: number): string =>
  `https://images.ygoprodeck.com/images/cards_small/${code}.jpg`;

export interface FieldProps {
  board: DuelBoardView;
  /** Options « choisis un emplacement » en cours, s'il y en a. */
  placeOptions: DuelPromptOption[];
  /** Passcodes des cartes sur lesquelles une action est proposée. */
  actionableCodes: number[];
  onHover: (card: DuelCardView | null) => void;
  onCardClick: (card: DuelCardView) => void;
  onPlace: (optionId: string) => void;
  onOpenZone: (zone: 'extra' | 'grave' | 'banished', side: 'me' | 'foe') => void;
}

export function DuelField({
  board,
  placeOptions,
  actionableCodes,
  onHover,
  onCardClick,
  onPlace,
  onOpenZone,
}: FieldProps) {
  /** L'option qui désigne exactement cette case, si le moteur la propose. */
  const placeFor = (seat: 0 | 1, location: number, sequence: number) =>
    placeOptions.find(
      (o) => o.controller === seat && o.location === location && o.sequence === sequence
    );


  /**
   * Les deux Zones Monstre Supplémentaires sont communes aux deux joueurs. Le
   * moteur les expose dans les indices 5 et 6 de **celui qui les occupe** : on
   * regarde donc des deux côtés pour savoir ce qui s'y trouve.
   */
  const extraMonsterZone = (index: 0 | 1): { card: DuelZoneView; owner: 'me' | 'foe' } => {
    const mine = board.me.monsters[5 + index] ?? null;
    if (mine) return { card: mine, owner: 'me' };
    return { card: board.opponent.monsters[5 + index] ?? null, owner: 'foe' };
  };

  return (
    <div style={{ display: 'grid', justifyContent: 'center', gap: 10 }}>
      {/* ── Main adverse, dos visible ── */}
      <HiddenHand count={board.opponent.handCount} />

      {/* ── Camp adverse, retourné ── */}
      <Row>
        <Slot kind="deck" label="Deck" count={board.opponent.deckCount} />
        {[4, 3, 2, 1, 0].map((seq) => (
          <Zone
            key={`fs${seq}`}
            card={board.opponent.spells[seq] ?? null}
            onHover={onHover}
            onClick={() => undefined}
          />
        ))}
        <Slot
          kind="extra"
          label="Extra"
          count={board.opponent.extraCount}
          onClick={() => onOpenZone('extra', 'foe')}
        />
      </Row>
      <Row>
        <Slot
          kind="grave"
          label="Cimetière"
          count={board.opponent.graveyard.length}
          onClick={() => onOpenZone('grave', 'foe')}
        />
        {[4, 3, 2, 1, 0].map((seq) => (
          <Zone
            key={`fm${seq}`}
            card={board.opponent.monsters[seq] ?? null}
            onHover={onHover}
            onClick={() => undefined}
          />
        ))}
        <Zone card={board.opponent.spells[5] ?? null} onHover={onHover} onClick={() => undefined} field />
      </Row>

      {/* ── Zones Monstre Supplémentaires, partagées ── */}
      <div style={{ display: 'flex', gap: GAP, justifyContent: 'center', padding: '4px 0' }}>
        {([0, 1] as const).map((i) => {
          const { card } = extraMonsterZone(i);
          const option = placeFor(board.seat, LOCATION_MZONE, 5 + i);
          return (
            <Zone
              key={`emz${i}`}
              card={card}
              label="Zone Monstre Extra"
              accent="var(--cyan)"
              placeable={!!option}
              onHover={onHover}
              onClick={() => (option ? onPlace(option.id) : card && onCardClick(card))}
            />
          );
        })}
      </div>

      {/* ── Mon camp ── */}
      <Row>
        <Zone
          card={board.me.spells[5] ?? null}
          onHover={onHover}
          onClick={() => {
            const o = placeFor(board.seat, LOCATION_SZONE, 5);
            const card = board.me.spells[5];
            if (o) onPlace(o.id);
            else if (card) onCardClick(card);
          }}
          placeable={!!placeFor(board.seat, LOCATION_SZONE, 5)}
          field
        />
        {[0, 1, 2, 3, 4].map((seq) => {
          const card = board.me.monsters[seq] ?? null;
          const option = placeFor(board.seat, LOCATION_MZONE, seq);
          return (
            <Zone
              key={`mm${seq}`}
              card={card}
              placeable={!!option}
              actionable={!!card && actionableCodes.includes(card.code)}
              onHover={onHover}
              onClick={() => (option ? onPlace(option.id) : card && onCardClick(card))}
            />
          );
        })}
        <Slot
          kind="grave"
          label="Cimetière"
          count={board.me.graveyard.length}
          onClick={() => onOpenZone('grave', 'me')}
        />
      </Row>
      <Row>
        <Slot
          kind="extra"
          label="Extra"
          count={board.me.extraCount}
          onClick={() => onOpenZone('extra', 'me')}
        />
        {[0, 1, 2, 3, 4].map((seq) => {
          const card = board.me.spells[seq] ?? null;
          const option = placeFor(board.seat, LOCATION_SZONE, seq);
          return (
            <Zone
              key={`ms${seq}`}
              card={card}
              placeable={!!option}
              actionable={!!card && actionableCodes.includes(card.code)}
              onHover={onHover}
              onClick={() => (option ? onPlace(option.id) : card && onCardClick(card))}
            />
          );
        })}
        <Slot kind="deck" label="Deck" count={board.me.deckCount} />
      </Row>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: GAP, justifyContent: 'center' }}>{children}</div>;
}

function Zone({
  card,
  label,
  accent,
  placeable,
  actionable,
  field,
  onHover,
  onClick,
}: {
  card: DuelZoneView;
  label?: string;
  accent?: string;
  placeable?: boolean;
  actionable?: boolean;
  field?: boolean;
  onHover: (c: DuelCardView | null) => void;
  onClick: () => void;
}) {
  const border = placeable
    ? 'var(--cyan)'
    : actionable
      ? 'var(--gold)'
      : accent ?? 'var(--border)';

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => card && onHover(card)}
      onMouseLeave={() => onHover(null)}
      disabled={!card && !placeable}
      style={{
        width: ZONE_W,
        height: ZONE_H,
        padding: 0,
        position: 'relative',
        border: `1px ${card ? 'solid' : 'dashed'} ${border}`,
        background: card ? 'var(--panel-2)' : 'var(--bg-elev)',
        // La case où l'on peut poser doit sauter aux yeux : c'est elle qu'on
        // clique, et non un bouton texte à côté du plateau.
        boxShadow: placeable
          ? '0 0 0 2px rgba(34,211,238,.35), 0 0 16px rgba(34,211,238,.45)'
          : actionable
            ? '0 0 10px rgba(245,197,24,.35)'
            : 'none',
        cursor: card || placeable ? 'pointer' : 'default',
        overflow: 'hidden',
      }}>
      {card ? (
        card.faceDown || card.code === 0 ? (
          <CardBack />
        ) : (
          <img
            src={cardImage(card.code)}
            alt={card.name ?? ''}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )
      ) : (
        <span
          style={{
            fontSize: 8,
            lineHeight: 1.2,
            color: placeable ? 'var(--cyan)' : 'var(--text-dim)',
            padding: 4,
            display: 'block',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
          {placeable ? '＋ Poser ici' : (label ?? (field ? 'Terrain' : ''))}
        </span>
      )}
    </button>
  );
}

/** Deck, Extra Deck, Cimetière : des piles, pas des cases de jeu. */
function Slot({
  kind,
  label,
  count,
  onClick,
}: {
  kind: 'deck' | 'extra' | 'grave';
  label: string;
  count: number;
  onClick?: () => void;
}) {
  const accent =
    kind === 'deck' ? 'var(--border)' : kind === 'extra' ? 'var(--violet)' : 'var(--magenta)';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={onClick ? `${label} — cliquer pour regarder` : label}
      style={{
        width: ZONE_W,
        height: ZONE_H,
        border: `1px solid ${accent}`,
        background: count > 0 ? 'var(--panel)' : 'var(--bg-elev)',
        display: 'grid',
        placeItems: 'center',
        gap: 2,
        cursor: onClick ? 'pointer' : 'default',
        padding: 0,
      }}>
      <span
        style={{
          fontSize: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: accent,
        }}>
        {label}
      </span>
      <strong style={{ fontSize: 16, color: 'var(--text)' }}>{count}</strong>
    </button>
  );
}

function CardBack() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(135deg, var(--panel-2), var(--bg-elev))',
      }}>
      <span style={{ color: 'var(--gold)', opacity: 0.55, fontSize: 20 }}>▨</span>
    </div>
  );
}

/**
 * Main adverse : on n'en montre que le volume, jamais le contenu.
 * Le dos des cartes rend l'information immédiate, là où un compteur oblige à
 * aller le chercher.
 */
function HiddenHand({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3, height: 42 }}>
      {Array.from({ length: Math.min(count, 12) }, (_, i) => (
        <div
          key={i}
          style={{
            width: 26,
            height: 38,
            border: '1px solid var(--border)',
            background: 'linear-gradient(135deg, var(--panel-2), var(--bg-elev))',
          }}
        />
      ))}
      <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        {count} carte{count > 1 ? 's' : ''} en main
      </span>
    </div>
  );
}

export default DuelField;
