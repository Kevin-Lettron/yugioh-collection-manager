import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { duelEngineApi } from '../services/duelEngineApi';
import DuelField from '../components/duel/DuelField';
import PhaseAnnouncer from '../components/duel/PhaseAnnouncer';
import type {
  DuelCardView,
  DuelPrompt,
  DuelPromptOption,
  DuelStateResponse,
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

/**
 * Noms de phases, en anglais.
 *
 * C'est la langue du jeu de competition : « Main Phase 1 » et « Battle Phase »
 * sont les termes qu'emploient les joueurs, francophones compris. Les traduire
 * ferait obstacle plus qu'aide.
 */
const PHASE_LABELS: Record<string, string> = {
  draw: 'Draw Phase',
  standby: 'Standby Phase',
  main1: 'Main Phase 1',
  battle_start: 'Battle Phase',
  battle_step: 'Battle Step',
  damage: 'Damage Step',
  damage_cal: 'Damage Calculation',
  battle: 'Battle Phase',
  main2: 'Main Phase 2',
  end: 'End Phase',
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
  const [phasesOpen, setPhasesOpen] = useState(false);
  /**
   * Un coup est en cours d'envoi.
   *
   * En ref et pas seulement en state : le sondage periodique est capture dans
   * un setInterval qui ne verrait jamais la valeur mise a jour, et ecraserait
   * l'etat en pleine action.
   */
  const busyRef = useRef(false);

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
    const unsubscribe = duelEngineApi.subscribe(duelId, {
      onUpdate: refresh,
      onEngineLost: ({ reason }) => {
        toast.error(`Duel interrompu (${reason}) — la partie est annulée, sans défaite.`);
        setState(null);
      },
    });

    /**
     * Filet de sécurité : on redemande l'état à intervalle régulier.
     *
     * Le temps réel repose sur le WebSocket, mais un socket peut ne pas être
     * connecté, tomber, ou être bloqué par un réseau d'entreprise. Sans ce
     * filet, la partie se fige et il faut recharger la page — ce qui est
     * exactement ce qu'on veut éviter. L'appel est bon marché : le worker
     * répond depuis sa mémoire, sans toucher à PostgreSQL.
     */
    const poll = setInterval(() => {
      if (!busyRef.current) void refresh();
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(poll);
    };
  }, [duelId, refresh]);

  const prompt = state?.prompt ?? null;

  /**
   * Répartition des options entre le plateau et la barre de commandes.
   *
   *   - `place` : les options désignent des cases. Elles ne doivent surtout pas
   *     devenir des boutons texte « Zone Monstre 3 » — on clique la case.
   *   - options portant une carte : c'est le menu contextuel de cette carte.
   *   - le reste (passer en phase de combat, phase de fin) : la barre.
   */
  const placeOptions = useMemo(
    () => (prompt?.kind === 'place' ? prompt.options : []),
    [prompt]
  );

  /**
   * Faut-il une fenêtre centrale pour répondre ?
   *
   * Règle : **oui dès qu'une option n'est atteignable ni sur le plateau ni dans
   * la main.** C'est le cas de la position d'invocation, d'un type ou d'un
   * attribut à annoncer, d'une carte à chercher dans le deck ou le cimetière.
   *
   * Ces demandes n'avaient nulle part où s'afficher, et la partie restait
   * bloquée sur un message sans bouton — « Position de Cyber Dragon » sans
   * moyen de choisir. Baser la règle sur l'emplacement plutôt que sur une liste
   * de types d'invite évite d'avoir à la rallonger à chaque cas oublié.
   */
  const needsDialog = useMemo(() => {
    if (!prompt || prompt.options.length === 0) return false;
    if (prompt.kind === 'place' || prompt.kind === 'main' || prompt.kind === 'battle') {
      return false;
    }
    // Emplacements que le plateau et la main rendent cliquables.
    const REACHABLE = [0x2, 0x4, 0x8]; // HAND, MZONE, SZONE
    return prompt.options.some(
      (o) => o.location === undefined || !REACHABLE.includes(o.location)
    );
  }, [prompt]);

  /**
   * Répond automatiquement aux demandes sans réponse possible.
   *
   * Le moteur demande parfois « veux-tu répondre en chaîne ? » alors qu'aucune
   * carte n'est activable. Poser la question dans ce cas n'a aucun sens : il
   * n'y a rien à choisir, et le joueur ne peut que cliquer « non ». On passe
   * pour lui.
   *
   * Uniquement si le moteur autorise le refus, évidemment : une chaîne
   * obligatoire sans option serait une anomalie qu'il vaut mieux laisser
   * visible que masquer derrière un envoi automatique.
   */
  useEffect(() => {
    if (!prompt || busy) return;
    const answerable = ['chain', 'confirm', 'option'].includes(prompt.kind);
    if (answerable && prompt.options.length === 0 && prompt.canCancel) {
      void send([], true);
    }
    // `send` est recréé à chaque rendu ; le dépendre ici relancerait l'effet en
    // boucle. L'invite et l'état d'occupation suffisent à décider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, busy]);

  /** Options sans carte : ce sont les changements de phase. */
  const phaseOptions = useMemo(
    () =>
      prompt?.kind === 'place'
        ? []
        : (prompt?.options ?? []).filter((o) => o.code === undefined),
    [prompt]
  );

  const send = async (optionIds: string[], cancel = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFocusedOptions(null);
    setPhasesOpen(false);
    setSelection([]);
    try {
      setState(await duelEngineApi.choose(duelId, { optionIds, cancel }));
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Choix refusé');
      await refresh();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  /**
   * Une option a été choisie sur le plateau.
   *
   * Choix unique : on envoie tout de suite. Choix multiple — sacrifier deux
   * monstres, par exemple : on accumule jusqu'à ce que le compte y soit, sinon
   * le premier clic enverrait une réponse incomplète que le moteur refuserait.
   */
  const pickOption = (optionId: string) => {
    if (!prompt) return;
    if (prompt.max <= 1) {
      void send([optionId]);
      return;
    }
    setSelection((cur) =>
      cur.includes(optionId)
        ? cur.filter((x) => x !== optionId)
        : [...cur, optionId].slice(0, prompt.max)
    );
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

      <div style={{ padding: '20px 20px 20px', maxWidth: 1100, margin: '0 auto' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
          <DuelField
            board={board}
            options={prompt?.options ?? []}
            selectedIds={selection}
            onOptionPicked={pickOption}
            onHover={setHovered}
            onCardMenu={(card, opts) =>
              setFocusedOptions({ title: card.name ?? 'Carte', options: opts })
            }
            onOpenZone={(zone, side) => setOpenZone(side === 'me' ? zone : null)}
          />
          <ActionRail
            prompt={prompt}
            busy={busy}
            currentPhase={PHASE_LABELS[board.phase] ?? board.phase}
            onOpenPhases={() => setPhasesOpen(true)}
          />
          </div>

          {/* Points de vie, de part et d'autre du plateau */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 48, marginTop: 14 }}>
            <LifePoints label="Adversaire" value={board.opponent.lp} />
            <LifePoints label="Toi" value={board.me.lp} mine />
          </div>

          {/* Une seule ligne : ce que le moteur demande. Les actions elles-mêmes
              se prennent sur les cartes — c'est là qu'on les cherche. */}
          <div
            style={{
              textAlign: 'center',
              margin: '14px 0 6px',
              fontSize: 13,
              color: prompt ? 'var(--gold)' : 'var(--text-muted)',
              fontWeight: 600,
            }}>
            {prompt ? prompt.message : "En attente de l'adversaire…"}
            {placeOptions.length > 0 && (
              <span style={{ color: 'var(--cyan)', marginLeft: 8 }}>
                — clique une case libre
              </span>
            )}
          </div>

          {/* ── Main */}
          <h3 style={{ ...sectionTitle, textAlign: 'center' }}>Ma main · {board.me.hand.length}</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {board.me.hand.map((card, i) => {
              /**
               * Les options d'une carte de la main se retrouvent par sa
               * **place** dans la main, pas par son passcode.
               *
               * Avec deux exemplaires de la même carte, filtrer par passcode
               * ramenait les options des deux — d'où le menu qui proposait
               * « Invoquer Ghost Ogre » deux fois de suite. La position, elle,
               * est unique.
               */
              const options = (prompt?.options ?? []).filter(
                (o) => o.location === 0x2 && o.sequence === i
              );
              return (
                <HandCard
                  key={`${card.code}-${i}`}
                  card={card}
                  actionable={options.length > 0}
                  onHover={setHovered}
                  onClick={() =>
                    options.length === 1
                      ? pickOption(options[0].id)
                      : options.length > 1 &&
                        setFocusedOptions({ title: card.name ?? 'Carte', options })
                  }
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
        {/* Journal flottant : il ne doit plus prendre une colonne de la mise en
            page, sinon le plateau se retrouve décalé sur la gauche au lieu
            d'occuper le centre de l'écran. */}
        <aside
          style={{
            ...panel,
            position: 'fixed',
            top: 78,
            right: 16,
            width: 290,
            maxHeight: '46vh',
            overflow: 'hidden',
            clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)',
          }}>
          <h3 style={{ ...sectionTitle, marginTop: 0 }}>Journal</h3>
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

      {/* Demandes qui exigent une réponse immédiate — répondre en chaîne,
          confirmer, choisir un effet.

          Elles s'imposent au centre de l'écran plutôt que d'attendre dans un
          coin : la partie est suspendue tant qu'on n'a pas répondu, et un
          bouton discret sur le côté laissait le joueur bloqué sans comprendre
          ce qu'on attendait de lui. */}
      {prompt && needsDialog && (
        <Overlay onClose={() => undefined}>
          <h4 style={{ margin: '0 0 4px', color: 'var(--gold)' }}>{prompt.message}</h4>
          {prompt.max > 1 && (
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>
              {selection.length} / {prompt.min === prompt.max ? prompt.min : `${prompt.min}–${prompt.max}`}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              maxHeight: '52vh',
              overflowY: 'auto',
              marginBottom: 14,
            }}>
            {prompt.options.map((o) => {
              const picked = selection.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={busy}
                  onClick={() => pickOption(o.id)}
                  onMouseEnter={() =>
                    o.code ? setHovered({ code: o.code, name: o.label, faceDown: false }) : undefined
                  }
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    display: 'grid',
                    gap: 6,
                    justifyItems: 'center',
                    padding: 8,
                    background: picked ? 'var(--success)' : 'var(--panel-2)',
                    color: picked ? 'var(--on-gold)' : 'var(--text)',
                    border: `1px solid ${picked ? 'var(--success)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    maxWidth: 120,
                  }}>
                  {/* Les cartes cherchées dans le deck ou le cimetière ne sont
                      nulle part sur le plateau : sans leur illustration, on
                      choisirait à l'aveugle depuis une liste de noms. */}
                  {o.code ? (
                    <img src={cardImage(o.code)} alt="" style={{ width: 72, display: 'block' }} />
                  ) : null}
                  <span style={{ fontSize: 11, lineHeight: 1.3, textAlign: 'center' }}>
                    {o.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {prompt.max > 1 && (
              <button
                type="button"
                disabled={busy || selection.length < prompt.min}
                onClick={() => send(selection)}
                style={btn('var(--cyan)')}>
                Valider
              </button>
            )}
            {prompt.canCancel && (
              <button type="button" disabled={busy} onClick={() => send([], true)} style={ghostBtn}>
                {prompt.kind === 'chain' ? 'Ne pas répondre' : 'Passer'}
              </button>
            )}
          </div>
        </Overlay>
      )}

      {/* Choix de la phase suivante, parmi celles que le moteur autorise. */}
      {phasesOpen && (
        <Overlay onClose={() => setPhasesOpen(false)}>
          <h4 style={{ margin: '0 0 4px', color: 'var(--violet)' }}>Aller à quelle phase ?</h4>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-muted)' }}>
            Seules les phases atteignables depuis {PHASE_LABELS[board.phase] ?? board.phase} sont
            proposées.
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
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
            {phaseOptions.length === 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Aucun changement de phase possible pour le moment.
              </span>
            )}
          </div>
        </Overlay>
      )}

      {/* Annonces de tour et de phase, par-dessus le plateau. */}
      <PhaseAnnouncer log={log} />

      {/* ── Détail au survol */}
      {hovered && hovered.code > 0 && <HoverCard card={hovered} />}
    </div>
  );
}

// ─── Sous-composants ────────────────────────────────────────────────────────

/**
 * Rail d'actions, ancré à droite.
 *
 * Il ne contient **que** ce qui ne se prend pas sur une carte : le changement
 * de phase et le refus de répondre. Tout le reste — invoquer, poser, activer —
 * se déclenche en cliquant la carte concernée, qui est mise en surbrillance.
 *
 * La version précédente listait toutes les actions dans une grande barre. Ça
 * marchait, mais ça déportait le jeu hors du plateau : on lisait des boutons
 * texte au lieu de regarder ses cartes.
 */
function ActionRail({
  prompt,
  busy,
  currentPhase,
  onOpenPhases,
}: {
  prompt: DuelPrompt | null;
  busy: boolean;
  currentPhase: string;
  onOpenPhases: () => void;
}) {
  const phaseCount = (prompt?.options ?? []).filter((o) => o.code === undefined).length;

  return (
    <div
      style={{ display: 'grid', gap: 10, width: 128, alignSelf: 'center' }}>
      <button
        type="button"
        disabled={busy || phaseCount === 0}
        onClick={onOpenPhases}
        title={
          phaseCount === 0
            ? 'Aucun changement de phase possible pour le moment'
            : 'Choisir la phase suivante'
        }
        style={{
          ...btn('var(--violet)'),
          opacity: phaseCount === 0 ? 0.4 : 1,
          cursor: phaseCount === 0 ? 'not-allowed' : 'pointer',
        }}>
        <span style={{ display: 'block', fontSize: 9, opacity: 0.75, letterSpacing: '0.1em' }}>
          Phase actuelle
        </span>
        {currentPhase}
      </button>

    </div>
  );
}

/** Points de vie, en gros : c'est l'information qu'on regarde le plus souvent. */
function LifePoints({ label, value, mine }: { label: string; value: number; mine?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <strong
        style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 26,
          color: mine ? 'var(--gold)' : 'var(--text)',
        }}>
        {value}
      </strong>
    </div>
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
