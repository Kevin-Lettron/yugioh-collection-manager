import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { duelEngineApi } from '../services/duelEngineApi';
import type {
  DuelCardView,
  DuelPrompt,
  DuelPromptOption,
  DuelStateResponse,
  DuelZoneView,
} from '../../../shared/duelView';

/**
 * Arène pilotée par ygopro-core.
 *
 * Différence de fond avec le duel manuel : **le joueur ne décide de rien de son
 * propre chef.** Il ne pioche pas, il ne change pas de phase, il ne pose pas où
 * il veut. Le moteur énonce ce qui est légal — invoquer, poser, activer, passer
 * en phase de combat — et le joueur choisit dans cette liste. C'est ce qui rend
 * les règles inviolables : une action non proposée n'existe pas.
 *
 * L'écran n'est donc qu'un afficheur d'invite. Toute l'intelligence est côté
 * moteur, et c'est très bien ainsi : réimplémenter les règles ici, ce serait
 * refaire ygopro-core en moins bon.
 */

const PHASE_LABELS: Record<string, string> = {
  draw: 'Phase de Pioche',
  standby: 'Phase de Standby',
  main1: 'Phase Principale 1',
  battle_start: 'Début de la Phase de Combat',
  battle_step: 'Battle Step',
  damage: 'Damage Step',
  damage_cal: 'Calcul des dégâts',
  battle: 'Phase de Combat',
  main2: 'Phase Principale 2',
  end: 'Phase de Fin',
  unknown: '—',
};

const cardImage = (code: number): string =>
  `https://images.ygoprodeck.com/images/cards_small/${code}.jpg`;

export default function EngineDuelRoom() {
  const { id } = useParams<{ id: string }>();
  const duelId = Number(id);
  const navigate = useNavigate();

  const [state, setState] = useState<DuelStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hovered, setHovered] = useState<DuelCardView | null>(null);
  const [focusedOptions, setFocusedOptions] = useState<{
    title: string;
    options: DuelPromptOption[];
  } | null>(null);
  const [openZone, setOpenZone] = useState<'extra' | 'grave' | 'banished' | null>(null);
  const [selection, setSelection] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      setState(await duelEngineApi.view(duelId));
    } catch (err: any) {
      // 404 = la partie n'est pas ouverte dans le moteur. On la lance.
      if (err?.response?.status === 404) {
        try {
          setState(await duelEngineApi.start(duelId));
        } catch (startErr: any) {
          toast.error(startErr?.response?.data?.error || "Impossible d'ouvrir le duel");
        }
      } else {
        toast.error(err?.response?.data?.error || 'Duel injoignable');
      }
    } finally {
      setLoading(false);
    }
  }, [duelId]);

  useEffect(() => {
    if (!Number.isInteger(duelId)) return;
    refresh();
    // Le serveur signale seulement qu'il y a du changement : chacun redemande
    // sa propre vue. Diffuser l'état dans la salle commune révélerait la main
    // de l'un à l'autre.
    return duelEngineApi.subscribe(duelId, {
      onUpdate: refresh,
      onEngineLost: ({ reason }) => {
        toast.error(`Duel interrompu (${reason}) — la partie est annulée, sans défaite.`);
        setState(null);
      },
    });
  }, [duelId, refresh]);

  const prompt = state?.prompt ?? null;

  // Les options sans carte associée sont les commandes de phase : elles vont
  // dans la barre de commandes, pas sur le plateau.
  const phaseOptions = useMemo(
    () => (prompt?.options ?? []).filter((o) => o.code === undefined),
    [prompt]
  );

  const send = async (optionIds: string[], cancel = false) => {
    if (busy) return;
    setBusy(true);
    setFocusedOptions(null);
    setSelection([]);
    try {
      setState(await duelEngineApi.choose(duelId, { optionIds, cancel }));
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Choix refusé');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  /**
   * Ouvre le menu contextuel d'une carte.
   *
   * C'est ici que se matérialise « cliquer une carte propose ce qu'on peut en
   * faire » : on ne devine pas les actions possibles, on filtre celles que le
   * moteur a déjà déclarées légales pour cette carte.
   */
  const openCardMenu = (card: DuelCardView, label: string) => {
    if (!prompt) return;
    const options = prompt.options.filter((o) => o.code === card.code);
    if (!options.length) return;
    setFocusedOptions({ title: label, options });
  };

  const toggleSelection = (optionId: string) => {
    if (!prompt) return;
    setSelection((cur) => {
      const next = cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId];
      // Sélection unitaire : on envoie tout de suite plutôt que de demander
      // une confirmation qui n'apporte rien.
      if (prompt.max === 1 && next.length === 1) {
        void send(next);
        return [];
      }
      return next.slice(0, prompt.max);
    });
  };

  if (!Number.isInteger(duelId)) return null;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Ouverture de l'arène…</span>
      </div>
    );
  }

  if (!state) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', gap: 16 }}>
        <p style={{ color: 'var(--text-muted)' }}>Ce duel n'est pas ouvert dans le moteur.</p>
        <button type="button" onClick={() => navigate('/duels')} style={btn('var(--gold)')}>
          Retour aux duels
        </button>
      </div>
    );
  }

  const { board, log } = state;
  const myTurn = board.turnPlayer === board.seat;

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: 'transparent' }}>
      {/* ── Bandeau : tour, phase, à qui de jouer */}
      <header style={header}>
        <button type="button" onClick={() => navigate('/duels')} style={ghostBtn}>
          ← Retour
        </button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <strong style={{ fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.12em' }}>
            TOUR {board.turn}
          </strong>
          <span style={{ color: 'var(--gold)', fontWeight: 700 }}>
            {PHASE_LABELS[board.phase] ?? board.phase}
          </span>
          <span style={{ color: myTurn ? 'var(--cyan)' : 'var(--text-muted)', fontSize: 13 }}>
            {myTurn ? 'à toi de jouer' : "au tour de l'adversaire"}
          </span>
          {board.chainLength > 0 && (
            <span style={{ color: 'var(--magenta)', fontSize: 12 }}>
              chaîne · {board.chainLength}
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Moteur ygopro-core</span>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20, padding: 20 }}>
        <div>
          {/* ── Adversaire */}
          <SideSummary side={board.opponent} label="Adversaire" onOpenZone={setOpenZone} foe />
          <ZoneRows
            side={board.opponent}
            mirrored
            onHover={setHovered}
            onCardClick={() => undefined}
            highlight={[]}
          />

          <div style={separator}>
            {prompt ? (
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{prompt.message}</span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>En attente de l'adversaire…</span>
            )}
          </div>

          {/* ── Mon côté */}
          <ZoneRows
            side={board.me}
            onHover={setHovered}
            onCardClick={(card, label) => openCardMenu(card, label)}
            highlight={(prompt?.options ?? [])
              .filter((o) => o.code !== undefined)
              .map((o) => o.code as number)}
          />
          <SideSummary side={board.me} label="Toi" onOpenZone={setOpenZone} />

          {/* ── Commandes de phase */}
          {phaseOptions.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              {phaseOptions.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={busy}
                  onClick={() => send([o.id])}
                  style={btn('var(--violet)')}>
                  {o.label}
                </button>
              ))}
              {prompt?.canCancel && (
                <button type="button" disabled={busy} onClick={() => send([], true)} style={ghostBtn}>
                  Passer
                </button>
              )}
            </div>
          )}

          {/* ── Main */}
          <h3 style={sectionTitle}>Ma main · {board.me.hand.length}</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {board.me.hand.map((card, i) => {
              const actionable = (prompt?.options ?? []).some((o) => o.code === card.code);
              return (
                <HandCard
                  key={`${card.code}-${i}`}
                  card={card}
                  actionable={actionable}
                  onHover={setHovered}
                  onClick={() => openCardMenu(card, card.name ?? 'Carte')}
                />
              );
            })}
            {board.me.hand.length === 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Main vide.</span>
            )}
          </div>

          {/* ── Sélection multiple en cours */}
          {prompt && prompt.max > 1 && (
            <MultiSelect
              prompt={prompt}
              selection={selection}
              onToggle={toggleSelection}
              onConfirm={() => send(selection)}
              onCancel={() => send([], true)}
              busy={busy}
            />
          )}
        </div>

        {/* ── Journal */}
        <aside style={panel}>
          <h3 style={sectionTitle}>Journal</h3>
          <div style={{ display: 'grid', gap: 4, maxHeight: '60vh', overflowY: 'auto' }}>
            {log.length === 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Rien encore.</span>
            )}
            {[...log].reverse().map((entry, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--violet)' }}>›</span> {entry.text}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ── Menu contextuel d'une carte */}
      {focusedOptions && (
        <Overlay onClose={() => setFocusedOptions(null)}>
          <h4 style={{ margin: '0 0 12px', color: 'var(--gold)' }}>{focusedOptions.title}</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {focusedOptions.options.map((o) => (
              <button
                key={o.id}
                type="button"
                disabled={busy}
                onClick={() => (prompt && prompt.max > 1 ? toggleSelection(o.id) : send([o.id]))}
                style={btn('var(--gold)')}>
                {o.label}
              </button>
            ))}
          </div>
        </Overlay>
      )}

      {/* ── Contenu d'une zone */}
      {openZone && (
        <Overlay onClose={() => setOpenZone(null)}>
          <h4 style={{ margin: '0 0 12px', color: 'var(--cyan)' }}>
            {openZone === 'extra' ? 'Extra Deck' : openZone === 'grave' ? 'Cimetière' : 'Bannies'}
          </h4>
          <CardGrid
            cards={
              openZone === 'grave'
                ? board.me.graveyard
                : openZone === 'banished'
                  ? board.me.banished
                  : []
            }
            emptyLabel={
              openZone === 'extra'
                ? `${board.me.extraCount} carte(s) — contenu masqué tant qu'elles ne sont pas révélées.`
                : 'Zone vide.'
            }
            onHover={setHovered}
          />
        </Overlay>
      )}

      {/* ── Détail au survol */}
      {hovered && hovered.code > 0 && <HoverCard card={hovered} />}
    </div>
  );
}

// ─── Sous-composants ────────────────────────────────────────────────────────

function SideSummary({
  side,
  label,
  foe,
  onOpenZone,
}: {
  side: DuelStateResponse['board']['me'];
  label: string;
  foe?: boolean;
  onOpenZone: (z: 'extra' | 'grave' | 'banished') => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0' }}>
      <strong style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 12, letterSpacing: '0.14em' }}>
        {label}
      </strong>
      <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 18 }}>{side.lp}</span>
      <Counter label="Deck" value={side.deckCount} />
      <Counter label="Main" value={side.handCount} />
      <Counter
        label="Extra"
        value={side.extraCount}
        onClick={foe ? undefined : () => onOpenZone('extra')}
      />
      <Counter
        label="Cimetière"
        value={side.graveyard.length}
        onClick={foe ? undefined : () => onOpenZone('grave')}
      />
      <Counter
        label="Bannies"
        value={side.banished.length}
        onClick={foe ? undefined : () => onOpenZone('banished')}
      />
    </div>
  );
}

function Counter({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        background: 'var(--panel-2)',
        border: '1px solid var(--border)',
        padding: '4px 10px',
        color: 'var(--text-muted)',
        fontSize: 11,
        cursor: onClick ? 'pointer' : 'default',
      }}>
      {label} <strong style={{ color: 'var(--text)' }}>{value}</strong>
    </button>
  );
}

/**
 * Les deux rangées du terrain.
 *
 * Sept zones monstre et non cinq : le moteur expose les deux zones monstre
 * supplémentaires de la Master Rule 5, celles où atterrissent les monstres
 * Lien et les invocations depuis l'Extra Deck.
 */
function ZoneRows({
  side,
  mirrored,
  onHover,
  onCardClick,
  highlight,
}: {
  side: DuelStateResponse['board']['me'];
  mirrored?: boolean;
  onHover: (c: DuelCardView | null) => void;
  onCardClick: (card: DuelCardView, label: string) => void;
  highlight: number[];
}) {
  const rows = mirrored
    ? [side.spells, side.monsters]
    : [side.monsters, side.spells];

  return (
    <div style={{ display: 'grid', gap: 6, margin: '6px 0' }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {row.map((zone, zi) => (
            <Zone
              key={zi}
              zone={zone}
              highlighted={!!zone && highlight.includes(zone.code)}
              onHover={onHover}
              onClick={() => zone && onCardClick(zone, zone.name ?? 'Carte')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Zone({
  zone,
  highlighted,
  onHover,
  onClick,
}: {
  zone: DuelZoneView;
  highlighted: boolean;
  onHover: (c: DuelCardView | null) => void;
  onClick: () => void;
}) {
  if (!zone) {
    return (
      <div
        style={{
          width: 62,
          height: 90,
          border: '1px dashed var(--border)',
          background: 'var(--bg-elev)',
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => onHover(zone)}
      onMouseLeave={() => onHover(null)}
      style={{
        width: 62,
        height: 90,
        padding: 0,
        border: `1px solid ${highlighted ? 'var(--gold)' : 'var(--border)'}`,
        boxShadow: highlighted ? '0 0 12px rgba(245,197,24,.4)' : 'none',
        background: 'var(--panel-2)',
        cursor: 'pointer',
        overflow: 'hidden',
      }}>
      {zone.faceDown || zone.code === 0 ? (
        <span style={{ color: 'var(--gold)', fontSize: 22, opacity: 0.6 }}>▨</span>
      ) : (
        <img
          src={cardImage(zone.code)}
          alt={zone.name ?? ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
    </button>
  );
}

function HandCard({
  card,
  actionable,
  onHover,
  onClick,
}: {
  card: DuelCardView;
  actionable: boolean;
  onHover: (c: DuelCardView | null) => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => onHover(card)}
      onMouseLeave={() => onHover(null)}
      title={actionable ? 'Actions disponibles' : 'Rien à en faire pour l’instant'}
      style={{
        width: 76,
        padding: 0,
        border: `2px solid ${actionable ? 'var(--gold)' : 'transparent'}`,
        background: 'transparent',
        cursor: actionable ? 'pointer' : 'default',
        opacity: actionable ? 1 : 0.62,
      }}>
      <img
        src={cardImage(card.code)}
        alt={card.name ?? ''}
        style={{ width: '100%', display: 'block' }}
      />
    </button>
  );
}

function CardGrid({
  cards,
  emptyLabel,
  onHover,
}: {
  cards: DuelCardView[];
  emptyLabel: string;
  onHover: (c: DuelCardView | null) => void;
}) {
  if (!cards.length) {
    return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{emptyLabel}</p>;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
      {cards.map((c, i) => (
        <img
          key={`${c.code}-${i}`}
          src={cardImage(c.code)}
          alt={c.name ?? ''}
          onMouseEnter={() => onHover(c)}
          onMouseLeave={() => onHover(null)}
          style={{ width: 72, border: '1px solid var(--border)' }}
        />
      ))}
    </div>
  );
}

/** Détail affiché au survol : nom, caractéristiques, et le texte que le moteur applique. */
function HoverCard({ card }: { card: DuelCardView }) {
  return (
    <div
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        width: 320,
        background: 'var(--panel)',
        border: '1px solid var(--gold)',
        padding: 14,
        zIndex: 8000,
        pointerEvents: 'none',
      }}>
      <strong style={{ color: 'var(--gold)', fontSize: 14 }}>{card.name}</strong>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 8px' }}>
        {card.level !== undefined && `Niveau ${card.level}`}
        {card.attack !== undefined && ` · ATK ${card.attack}`}
        {card.defense !== undefined && ` · DEF ${card.defense}`}
        {card.materials ? ` · ${card.materials} matériau(x)` : ''}
      </div>
      {card.description && (
        <p style={{ fontSize: 12, color: 'var(--text)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          {card.description}
        </p>
      )}
    </div>
  );
}

function MultiSelect({
  prompt,
  selection,
  onToggle,
  onConfirm,
  onCancel,
  busy,
}: {
  prompt: DuelPrompt;
  selection: string[];
  onToggle: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const enough = selection.length >= prompt.min && selection.length <= prompt.max;
  return (
    <div style={{ ...panel, marginTop: 16 }}>
      <h3 style={sectionTitle}>
        {prompt.message} ({selection.length}/{prompt.min === prompt.max ? prompt.min : `${prompt.min}-${prompt.max}`})
      </h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {prompt.options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            style={{
              ...btn(selection.includes(o.id) ? 'var(--gold)' : 'var(--panel-2)'),
              color: selection.includes(o.id) ? 'var(--on-gold)' : 'var(--text)',
            }}>
            {o.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" disabled={!enough || busy} onClick={onConfirm} style={btn('var(--cyan)')}>
          Valider
        </button>
        {prompt.canCancel && (
          <button type="button" disabled={busy} onClick={onCancel} style={ghostBtn}>
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.7)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 8500,
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...panel, minWidth: 320, maxWidth: 640 }}>
        {children}
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 20px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg-elev)',
};

const panel: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  padding: 16,
};

const separator: React.CSSProperties = {
  textAlign: 'center',
  padding: '14px 0',
  borderTop: '1px solid var(--border)',
  borderBottom: '1px solid var(--border)',
  margin: '10px 0',
};

const sectionTitle: React.CSSProperties = {
  fontFamily: "'Orbitron', sans-serif",
  fontSize: 12,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--gold)',
  margin: '16px 0 8px',
};

function btn(accent: string): React.CSSProperties {
  return {
    padding: '9px 14px',
    background: accent,
    color: 'var(--on-gold)',
    border: 'none',
    fontFamily: "'Orbitron', sans-serif",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };
}

const ghostBtn: React.CSSProperties = {
  padding: '9px 14px',
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};
