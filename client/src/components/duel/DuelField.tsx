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
 * partagent les joueurs.
 *
 * Le camp adverse est le même plateau retourné : son Deck se retrouve à gauche
 * et son Cimetière à droite, exactement comme si on était assis en face.
 *
 * **Les deux camps sont interactifs.** Une option du moteur peut désigner une
 * case libre à soi (poser), une carte à soi (invoquer, activer, changer de
 * position) ou **une carte d'en face** — choisir une cible d'attaque. Rendre le
 * camp adverse inerte, c'était rendre l'attaque impossible.
 *
 * ── Indices exposés par le moteur ────────────────────────────────────────
 * `monsters` en compte 7 : 0 à 4 pour les zones principales, 5 et 6 pour les
 * Zones Monstre Supplémentaires. `spells` en compte 8 : 0 à 4 pour les
 * magies/pièges, **5 pour le Terrain**, 6 et 7 pour les zones Pendule des
 * anciennes Master Rules.
 */

/** Constantes d'emplacement du moteur, reprises pour cibler une zone. */
const LOCATION_MZONE = 0x4;
const LOCATION_SZONE = 0x8;

const ZONE_W = 64;
const ZONE_H = 93;

/**
 * Écart entre les cases.
 *
 * Il n'est pas cosmétique : un monstre en défense est couché, sa largeur
 * devient donc la hauteur de la carte. Il déborde de (93 − 64) / 2 = 15 px de
 * chaque côté. L'écart doit absorber ce débordement, sinon la carte se fait
 * rogner par la case voisine.
 */
const GAP = 18;

const cardImage = (code: number): string =>
  `https://images.ygoprodeck.com/images/cards_small/${code}.jpg`;

/** Dos de carte officiel — servi par la même source que les illustrations. */
const CARD_BACK = 'https://images.ygoprodeck.com/images/cards/back.jpg';

/**
 * Masque de position du moteur : 0x4 défense face visible, 0x8 défense face
 * cachée. Un monstre en défense se pose **couché**, c'est ce qui permet de lire
 * sa position d'un coup d'œil.
 */
const POSITION_DEFENSE = 0xc;
const isDefense = (card: DuelCardView): boolean =>
  ((card.position ?? 0) & POSITION_DEFENSE) !== 0;

export interface FieldProps {
  board: DuelBoardView;
  /** Toutes les options de l'invite en cours, sans tri préalable. */
  options: DuelPromptOption[];
  /** Options déjà retenues dans une sélection multiple. */
  selectedIds: string[];
  /** Une option rattachée au plateau a été choisie. */
  onOptionPicked: (optionId: string) => void;
  onHover: (card: DuelCardView | null) => void;
  /** Une carte offre plusieurs actions : à l'appelant d'ouvrir un menu. */
  onCardMenu: (card: DuelCardView, options: DuelPromptOption[]) => void;
  onOpenZone: (zone: 'extra' | 'grave' | 'banished', side: 'me' | 'foe') => void;
}

export function DuelField({
  board,
  options,
  selectedIds,
  onOptionPicked,
  onHover,
  onCardMenu,
  onOpenZone,
}: FieldProps) {
  const foeSeat: 0 | 1 = board.seat === 0 ? 1 : 0;

  /** Les options qui désignent exactement cette case. */
  const at = (seat: 0 | 1, location: number, sequence: number) =>
    options.filter(
      (o) => o.controller === seat && o.location === location && o.sequence === sequence
    );

  /**
   * Fabrique une case du plateau.
   *
   * Un seul chemin pour les deux camps : c'est ce qui garantit qu'une cible
   * adverse est cliquable au même titre qu'une carte à soi.
   */
  const renderZone = (
    seat: 0 | 1,
    location: number,
    sequence: number,
    card: DuelZoneView,
    extra?: { label?: string; accent?: string; field?: boolean; key?: string }
  ) => {
    const here = at(seat, location, sequence);
    // Une option sans carte sur une case désigne forcément une pose.
    const place = here.find((o) => o.code === undefined);
    const targets = here.filter((o) => o.code !== undefined);
    const selected = here.some((o) => selectedIds.includes(o.id));

    const onClick = () => {
      if (place) return onOptionPicked(place.id);
      if (targets.length === 1) return onOptionPicked(targets[0].id);
      if (targets.length > 1 && card) return onCardMenu(card, targets);
    };

    return (
      <Zone
        key={extra?.key ?? `${seat}-${location}-${sequence}`}
        card={card}
        label={extra?.label}
        accent={extra?.accent}
        field={extra?.field}
        placeable={!!place}
        actionable={targets.length > 0}
        selected={selected}
        onHover={onHover}
        onClick={onClick}
      />
    );
  };

  /**
   * Les deux Zones Monstre Supplémentaires sont communes aux deux joueurs. Le
   * moteur les expose dans les indices 5 et 6 de **celui qui les occupe** : on
   * regarde donc des deux côtés pour savoir ce qui s'y trouve.
   */
  const extraMonsterCard = (index: 0 | 1): DuelZoneView =>
    board.me.monsters[5 + index] ?? board.opponent.monsters[5 + index] ?? null;

  return (
    <div style={{ display: 'grid', justifyContent: 'center', gap: 10 }}>
      {/* ── Main adverse, dos visible ── */}
      <HiddenHand count={board.opponent.handCount} />

      {/* ── Camp adverse, retourné ── */}
      <Row>
        <Slot kind="deck" label="Deck" count={board.opponent.deckCount} />
        {[4, 3, 2, 1, 0].map((seq) =>
          renderZone(foeSeat, LOCATION_SZONE, seq, board.opponent.spells[seq] ?? null)
        )}
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
        {[4, 3, 2, 1, 0].map((seq) =>
          renderZone(foeSeat, LOCATION_MZONE, seq, board.opponent.monsters[seq] ?? null)
        )}
        {renderZone(foeSeat, LOCATION_SZONE, 5, board.opponent.spells[5] ?? null, {
          field: true,
        })}
      </Row>

      {/* ── Zones Monstre Supplémentaires, partagées ── */}
      <div style={{ display: 'flex', gap: GAP, justifyContent: 'center', padding: '4px 0' }}>
        {([0, 1] as const).map((i) =>
          renderZone(board.seat, LOCATION_MZONE, 5 + i, extraMonsterCard(i), {
            label: 'Zone Monstre Extra',
            accent: 'var(--cyan)',
            key: `emz${i}`,
          })
        )}
      </div>

      {/* ── Mon camp ── */}
      <Row>
        {renderZone(board.seat, LOCATION_SZONE, 5, board.me.spells[5] ?? null, { field: true })}
        {[0, 1, 2, 3, 4].map((seq) =>
          renderZone(board.seat, LOCATION_MZONE, seq, board.me.monsters[seq] ?? null)
        )}
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
        {[0, 1, 2, 3, 4].map((seq) =>
          renderZone(board.seat, LOCATION_SZONE, seq, board.me.spells[seq] ?? null)
        )}
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
  selected,
  field,
  onHover,
  onClick,
}: {
  card: DuelZoneView;
  label?: string;
  accent?: string;
  placeable?: boolean;
  actionable?: boolean;
  selected?: boolean;
  field?: boolean;
  onHover: (c: DuelCardView | null) => void;
  onClick: () => void;
}) {
  const border = selected
    ? 'var(--success)'
    : placeable
      ? 'var(--cyan)'
      : actionable
        ? 'var(--gold)'
        : (accent ?? 'var(--border)');

  const glow = selected
    ? '0 0 0 2px rgba(52,211,153,.5), 0 0 16px rgba(52,211,153,.5)'
    : placeable
      ? '0 0 0 2px rgba(34,211,238,.35), 0 0 16px rgba(34,211,238,.45)'
      : actionable
        ? '0 0 0 2px rgba(245,197,24,.4), 0 0 14px rgba(245,197,24,.45)'
        : 'none';

  const clickable = placeable || actionable;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => card && onHover(card)}
      onMouseLeave={() => onHover(null)}
      disabled={!clickable}
      style={{
        width: ZONE_W,
        height: ZONE_H,
        padding: 0,
        position: 'relative',
        border: `1px ${card ? 'solid' : 'dashed'} ${border}`,
        background: card ? 'var(--panel-2)' : 'var(--bg-elev)',
        boxShadow: glow,
        cursor: clickable ? 'pointer' : 'default',
        // Volontairement pas de `overflow: hidden` : une carte couchée déborde
        // dans l'écart, et c'est ce débordement qui la rend lisible en entier.
        overflow: 'visible',
        zIndex: card && isDefense(card) ? 2 : 1,
      }}>
      {card ? (
        <img
          src={card.faceDown || card.code === 0 ? CARD_BACK : cardImage(card.code)}
          alt={card.faceDown ? 'Carte face cachée' : (card.name ?? '')}
          style={
            isDefense(card)
              ? {
                  // La carte garde ses proportions de portrait AVANT rotation :
                  // c'est le `rotate(90deg)` qui la couche. Pré-échanger la
                  // largeur et la hauteur en plus de la rotation annulait
                  // l'effet et redonnait une carte debout, simplement rognée.
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: ZONE_W - 6,
                  height: ZONE_H - 6,
                  marginTop: -(ZONE_H - 6) / 2,
                  marginLeft: -(ZONE_W - 6) / 2,
                  transform: 'rotate(90deg)',
                  transformOrigin: 'center',
                  objectFit: 'cover',
                  boxShadow: '0 3px 10px rgba(0,0,0,.6)',
                }
              : { width: '100%', height: '100%', objectFit: 'cover' }
          }
        />
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

/**
 * Main adverse : on n'en montre que le volume, jamais le contenu.
 * Le dos des cartes rend l'information immédiate, là où un compteur oblige à
 * aller la chercher.
 */
function HiddenHand({ count }: { count: number }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 3,
        height: 44,
      }}>
      {Array.from({ length: Math.min(count, 12) }, (_, i) => (
        <img
          key={i}
          src={CARD_BACK}
          alt=""
          style={{
            width: 27,
            height: 39,
            objectFit: 'cover',
            border: '1px solid var(--border)',
            // Légère superposition : une main se tient en éventail, pas étalée.
            marginLeft: i === 0 ? 0 : -8,
            boxShadow: '0 2px 6px rgba(0,0,0,.5)',
          }}
        />
      ))}
      <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--text-muted)' }}>
        {count} carte{count > 1 ? 's' : ''} en main
      </span>
    </div>
  );
}

export default DuelField;
