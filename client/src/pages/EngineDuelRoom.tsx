import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { duelEngineApi } from '../services/duelEngineApi';
import DuelField from '../components/duel/DuelField';
import PhaseAnnouncer from '../components/duel/PhaseAnnouncer';
import { useAuth } from '../context/AuthContext';
import { duelApi } from '../services/duelApi';
import type { Duel } from '../../../shared/types';
import type {
  DuelAnimationEvent,
  DuelAnnounceSearchResult,
  DuelCardView,
  DuelChoice,
  DuelCombatLogEntry,
  DuelLogEntry,
  DuelPreGameState,
  DuelPrompt,
  DuelPromptOption,
  DuelRevealBatch,
  DuelStateResponse,
  DuelTossEvent,
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
  const { user } = useAuth();

  const [state, setState] = useState<DuelStateResponse | null>(null);
  const [duel, setDuel] = useState<Duel | null>(null);
  const [preGame, setPreGame] = useState<DuelPreGameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  /**
   * Erreur fatale côté serveur qui rend la partie injouable (moteur non installé,
   * cards.cdb manquant, panne loader). Quand elle est posée, on arrête le
   * polling et on affiche un panneau plutôt que de continuer à taper l'API en
   * boucle — sans ça, chaque poll spam un toast d'erreur et pollue les logs.
   */
  const [engineFatal, setEngineFatal] = useState<string | null>(null);
  const engineFatalRef = useRef<string | null>(null);
  const [hovered, setHovered] = useState<DuelCardView | null>(null);
  /**
   * Menu contextuel d'une carte — Bloc 3 §4bis.
   *
   * RIEN n'est envoyé au serveur tant que le joueur n'a pas cliqué « Valider ».
   * Cet état encapsule le choix bufferisé : la carte concernée, les options
   * dispo, et l'option cochée pour l'instant. Un clic « Annuler » remet à
   * null sans rien envoyer — le prompt serveur reste ouvert, le joueur peut
   * cliquer une autre carte.
   */
  const [cardMenu, setCardMenu] = useState<{
    title: string;
    card: DuelCardView | null;
    options: DuelPromptOption[];
    pickedId: string | null;
  } | null>(null);
  /**
   * Ouverte : consultation d'une zone. `side='foe'` autorise l'Extra Deck
   * adverse (public en YGO) — le cimetière adverse l'était déjà.
   */
  const [openZone, setOpenZone] = useState<{
    kind: 'extra' | 'grave' | 'banished';
    side: 'me' | 'foe';
  } | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [phasesOpen, setPhasesOpen] = useState(false);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  /**
   * Confirmation « Terminer ton tour ? » — §C.3. Le check-box « Ne plus
   * demander cette partie » est purement local (pas persisté serveur).
   */
  const [endTurnConfirm, setEndTurnConfirm] = useState<{ optionId: string } | null>(null);
  const [endTurnMuted, setEndTurnMuted] = useState(false);
  /** Onglet actif du journal — §C.1 : Actions vs Déroulé. */
  const [logTab, setLogTab] = useState<'actions' | 'flow'>('actions');
  /**
   * Un coup est en cours d'envoi.
   *
   * En ref et pas seulement en state : le sondage periodique est capture dans
   * un setInterval qui ne verrait jamais la valeur mise a jour, et ecraserait
   * l'etat en pleine action.
   */
  const busyRef = useRef(false);

  /**
   * Charge l'état courant.
   *
   * Trois trajectoires possibles :
   *   1. Le duel est terminé → `duel.status === 'finished'` : on affiche l'écran de fin.
   *   2. On est en pile ou face → `preGame` avec sa phase.
   *   3. Le moteur tourne → `state` habituel.
   *
   * On lit `Duel` en base pour trancher la trajectoire — c'est la source de
   * vérité, alors que le moteur ne connaît rien du statut « pre_game ».
   */
  const refresh = useCallback(async () => {
    if (engineFatalRef.current) return;
    try {
      const currentDuel = await duelApi.get(duelId);
      setDuel(currentDuel);

      // Salle d'attente (migration 014) — tant qu'au moins un joueur n'a pas
      // cliqué « Prêt » ET que le pile ou face n'a pas démarré, on renvoie
      // dans le lobby plutôt que d'entrer dans l'arène. Sans ça, atterrir
      // ici via URL directe court-circuiterait le choix de deck.
      const bothReady = Boolean(currentDuel.challenger_ready && currentDuel.opponent_ready);
      if (!currentDuel.phase_pre_game && !currentDuel.first_player_id && !bothReady && currentDuel.status !== 'finished' && currentDuel.status !== 'cancelled') {
        navigate(`/duel/${duelId}/lobby`, { replace: true });
        return;
      }

      if (currentDuel.status === 'pre_game' || !currentDuel.first_player_id) {
        // On tente d'ouvrir la phase pré-game. Si `start` renvoie déjà l'état
        // moteur, on bascule directement.
        try {
          const result = await duelEngineApi.start(duelId);
          if (result.kind === 'pre_game') {
            setPreGame(result.preGame);
            setState(null);
          } else {
            setState(result.state);
            setPreGame(null);
          }
        } catch (err: any) {
          // Fallback : lecture pure de la pré-game si `start` refuse.
          if (currentDuel.status === 'pre_game') {
            setPreGame(await duelEngineApi.preGame(duelId));
          } else {
            toast.error(err?.response?.data?.error || 'Duel injoignable');
          }
        }
        return;
      }

      // Moteur actif — vue classique. 404 = pas encore instancié : on start.
      try {
        setState(await duelEngineApi.view(duelId));
        setPreGame(null);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          const result = await duelEngineApi.start(duelId);
          if (result.kind === 'pre_game') {
            setPreGame(result.preGame);
            setState(null);
          } else {
            setState(result.state);
            setPreGame(null);
          }
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      // Silence les 404 pendant la pre-game : le moteur n'est legitimement
      // pas encore instancie (le winner du coin flip n'a pas encore choisi
      // P1/P2), le polling 3s ne doit pas spam un toast rouge a chaque call.
      // Meme silence si on est dans une phase transitoire (accept en cours,
      // refresh WS qui arrive avant que le backend ait bascule active).
      const status = err?.response?.status;
      const serverMsg: string | undefined = err?.response?.data?.error;
      const isTransient404 = status === 404;
      // Erreurs fatales cote back qui rendent le duel injouable en l'etat :
      //  - assets moteur pas installes
      //  - deck illegal (banlist violee, tailles hors norme, cartes inconnues)
      //  - deck incomplet (les 2 joueurs n'ont pas choisi)
      // Inutile de continuer a taper l'API — on fige avec un panneau clair
      // qui donne la vraie cause au joueur au lieu de spammer un toast rouge.
      if (
        serverMsg &&
        /moteur.+installé|données manquantes|assets|deck illégal|deck.+incomplet|deck.+trop grand|cartes non jouables|choisi un deck/i.test(
          serverMsg
        )
      ) {
        engineFatalRef.current = serverMsg;
        setEngineFatal(serverMsg);
      } else if (!isTransient404) {
        toast.error(serverMsg || 'Duel injoignable');
      }
    } finally {
      setLoading(false);
    }
  }, [duelId, navigate]);

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
      onPreGame: (nextPreGame) => setPreGame(nextPreGame),
      onFinished: ({ reason }) => {
        const label =
          reason === 'surrender'
            ? 'Abandon'
            : reason === 'timeout'
              ? 'Temps écoulé'
              : 'Fin de partie';
        toast.success(label, { duration: 4000 });
        // On rafraîchit pour récupérer le statut « finished » et le vainqueur.
        void refresh();
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
      // Fatal serveur : plus la peine de poller — voir engineFatalRef.
      if (engineFatalRef.current) return;
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
    if (!prompt) return false;
    // Invites à réponse structurée : traitées par des modaux dédiés en bas.
    if (prompt.kind === 'select_counter' || prompt.kind === 'announce_card') return false;
    if (prompt.options.length === 0) return false;
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
   * Signale un coup refusé par le moteur.
   *
   * Le serveur ne pose `lastRetry` que pour le siège concerné, et l'efface
   * dès qu'un coup passe. On compare le timestamp pour ne pas ré-afficher
   * la même annonce à chaque poll — sinon le toast clignoterait toutes les
   * 3 secondes tant que le joueur n'a pas rejoué.
   */
  const lastRetryShownAt = useRef<number | null>(null);
  useEffect(() => {
    const retry = state?.lastRetry;
    if (!retry) {
      lastRetryShownAt.current = null;
      return;
    }
    if (lastRetryShownAt.current === retry.at) return;
    lastRetryShownAt.current = retry.at;
    toast.error(retry.note ?? 'Coup refusé — reprends ton choix.', {
      duration: 4000,
      icon: '⛔',
    });
  }, [state?.lastRetry]);

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

  const send = async (
    optionIds: string[],
    cancel = false,
    extra?: Pick<DuelChoice, 'counters' | 'announcedCode' | 'cardCodes'>
  ) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setCardMenu(null);
    setPhasesOpen(false);
    setSelection([]);
    setEndTurnConfirm(null);
    try {
      const choice: DuelChoice = { optionIds, cancel, ...(extra ?? {}) };
      setState(await duelEngineApi.choose(duelId, choice));
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Choix refusé');
      await refresh();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  /**
   * Ouvre le menu contextuel d'une carte sans rien envoyer au serveur.
   *
   * Cœur du flow §4bis : contrairement à Master Duel, on ne révèle rien à
   * l'adversaire tant que le joueur n'a pas validé. Le menu se ferme par
   * Valider (envoi de l'option choisie) ou Annuler (fermeture sèche).
   */
  const openCardMenu = (
    card: DuelCardView | null,
    title: string,
    opts: DuelPromptOption[]
  ) => {
    if (!opts.length) return;
    setCardMenu({ title, card, options: opts, pickedId: null });
  };

  /**
   * Une option a été choisie sur le plateau.
   *
   * Choix unique : on envoie tout de suite. Choix multiple — sacrifier deux
   * monstres, par exemple : on accumule jusqu'à ce que le compte y soit, sinon
   * le premier clic enverrait une réponse incomplète que le moteur refuserait.
   *
   * Exception §C.3 : si l'option termine le tour (`toep`), on ouvre la
   * confirmation « Terminer ton tour ? » plutôt que d'envoyer directement —
   * un clic malheureux ne doit pas coûter la manche.
   */
  const pickOption = (optionId: string) => {
    if (!prompt) return;
    if (prompt.max <= 1) {
      if (optionId === 'toep' && shouldConfirmEndTurn()) {
        setEndTurnConfirm({ optionId });
        return;
      }
      void send([optionId]);
      return;
    }
    setSelection((cur) =>
      cur.includes(optionId)
        ? cur.filter((x) => x !== optionId)
        : [...cur, optionId].slice(0, prompt.max)
    );
  };

  /**
   * Décide si la fin de tour doit être confirmée.
   *
   * Deux critères : main non vide en Main1 (le joueur n'a pas joué), ou
   * monstres avec attaque disponible en Battle Phase (attaque non déclarée).
   * `endTurnMuted` désactive la confirmation pour la partie en cours.
   */
  const shouldConfirmEndTurn = (): boolean => {
    if (endTurnMuted || !state) return false;
    const { board } = state;
    if (board.phase === 'main1' && board.me.hand.length > 0) return true;
    if (board.phase === 'battle' || board.phase === 'battle_start' || board.phase === 'battle_step') {
      const hasReadyMonster = board.me.monsters.some(
        (m) => m && !m.faceDown && ((m.position ?? 0) & 0x1) !== 0
      );
      if (hasReadyMonster) return true;
    }
    return false;
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

  if (engineFatal) {
    // Écran plein : le serveur nous a dit qu'il n'a pas les assets. On coupe
    // le polling (cf. engineFatalRef) et on donne à l'admin ce dont il a
    // besoin pour réparer — pas d'espoir d'auto-guérison côté client.
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: 'rgba(15,15,20,0.98)',
        }}
      >
        <div
          style={{
            maxWidth: 640,
            border: '1px solid #ff6b6b',
            padding: 24,
            borderRadius: 6,
            fontFamily: "'Rajdhani', system-ui, sans-serif",
            color: 'var(--text)',
          }}
        >
          <div style={{ color: '#ff6b6b', fontWeight: 700, marginBottom: 8 }}>
            Duel indisponible
          </div>
          <p style={{ margin: '0 0 16px', whiteSpace: 'pre-wrap' }}>{engineFatal}</p>
          <p style={{ opacity: 0.7, fontSize: 13, margin: '0 0 16px' }}>
            {/deck/i.test(engineFatal)
              ? "Un des decks n'est pas conforme (banlist, tailles). Editez le deck depuis « Mes decks » avant de relancer."
              : "L'administrateur doit installer les assets du moteur sur le serveur (npx ts-node scripts/fetchDuelAssets.ts)."}
          </p>
          <button
            onClick={() => navigate('/duels')}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--gold)',
              color: 'var(--gold)',
              cursor: 'pointer',
            }}
          >
            Retour à la liste des duels
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Ouverture de l'arène…</span>
      </div>
    );
  }

  // ─── Pile ou face (avant l'ouverture du moteur) ──────────────────────
  if (preGame && !state) {
    return (
      <PreGameScreen
        preGame={preGame}
        duel={duel}
        userId={user?.id ?? null}
        busy={busy}
        onFlip={async () => {
          setBusy(true);
          try {
            setPreGame(await duelEngineApi.coinFlip(duelId));
          } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Impossible de lancer la pièce');
          } finally {
            setBusy(false);
          }
        }}
        onChoice={async (choice) => {
          setBusy(true);
          try {
            const next = await duelEngineApi.firstPlayerChoice(duelId, choice);
            setPreGame(next);
            // Une fois `resolved`, on demande immédiatement au moteur de démarrer.
            if (next.phase === 'resolved') {
              const result = await duelEngineApi.start(duelId);
              if (result.kind === 'active') {
                setState(result.state);
                setPreGame(null);
              }
            }
          } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Choix impossible');
          } finally {
            setBusy(false);
          }
        }}
        onBack={() => navigate('/duels')}
      />
    );
  }

  if (!state) {
    // Duel terminé : on affiche l'écran de fin plutôt qu'un « non ouvert ».
    if (duel?.status === 'finished') {
      const iWon = duel.winner_id === user?.id;
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', gap: 16 }}>
          <h2 style={{ color: iWon ? 'var(--gold)' : 'var(--text-muted)' }}>
            {iWon ? 'Victoire' : 'Défaite'}
          </h2>
          <button type="button" onClick={() => navigate('/duels')} style={btn('var(--gold)')}>
            Retour aux duels
          </button>
        </div>
      );
    }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {state.clocks && (
            <ClockDisplay clocks={state.clocks} mySeat={board.seat} />
          )}
          <button
            type="button"
            onClick={() => setConfirmSurrender(true)}
            title="Abandonner la partie"
            style={{
              ...ghostBtn,
              color: 'var(--danger, #d84a4a)',
              borderColor: 'var(--danger, #d84a4a)',
            }}>
            Abandonner
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Moteur ygopro-core</span>
        </div>
      </header>

      {confirmSurrender && (
        <Overlay onClose={() => setConfirmSurrender(false)}>
          <h4 style={{ margin: '0 0 8px', color: 'var(--danger, #d84a4a)' }}>Abandonner ?</h4>
          <p style={{ margin: '0 0 14px', color: 'var(--text-muted)', fontSize: 13 }}>
            L'adversaire gagne immédiatement. Cette action est irréversible.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await duelEngineApi.surrender(duelId);
                  setConfirmSurrender(false);
                  toast.success('Duel abandonné');
                  navigate('/duels');
                } catch (err: any) {
                  toast.error(err?.response?.data?.error || "Impossible d'abandonner");
                } finally {
                  setBusy(false);
                }
              }}
              style={btn('var(--danger, #d84a4a)')}>
              Confirmer l'abandon
            </button>
            <button type="button" onClick={() => setConfirmSurrender(false)} style={ghostBtn}>
              Annuler
            </button>
          </div>
        </Overlay>
      )}

      <div style={{ padding: '20px 20px 20px', maxWidth: 1100, margin: '0 auto' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
          <DuelField
            board={board}
            options={prompt?.options ?? []}
            selectedIds={selection}
            onOptionPicked={pickOption}
            onHover={setHovered}
            onCardMenu={(card, opts) => openCardMenu(card, card.name ?? 'Carte', opts)}
            onOpenZone={(zone, side) => {
              // Extra Deck adverse : PUBLIC en YGO (règle officielle) — §C.4.
              // Le cimetière adverse l'était déjà côté DuelField, on ouvre
              // symétriquement l'Extra adverse.
              if (side === 'foe' && zone === 'extra') setOpenZone({ kind: 'extra', side });
              else if (side === 'foe' && zone === 'grave') setOpenZone({ kind: 'grave', side });
              else if (side === 'me') setOpenZone({ kind: zone, side });
            }}
          />
          <ActionRail
            prompt={prompt}
            busy={busy}
            currentPhase={PHASE_LABELS[board.phase] ?? board.phase}
            onOpenPhases={() => setPhasesOpen(true)}
          />
          {/* Rail chaîne — §5.2 gap #8 : afficher la pile des maillons */}
          {board.chain && board.chain.length > 0 && (
            <ChainPanel
              chain={board.chain}
              solvingLink={board.chainSolvingLink ?? null}
              mySeat={board.seat}
            />
          )}
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
                  // §4bis : même une carte à une seule option ouvre le menu
                  // bufferisé. Le joueur voit toujours ce qu'il s'apprête à
                  // faire, et peut annuler avant révélation à l'adversaire.
                  onClick={() =>
                    options.length > 0 &&
                    openCardMenu(card, card.name ?? 'Carte', options)
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

        {/* ── Journal — §C.1 : deux onglets pour séparer le narratif du procédural.
            - Actions : ce qui compte (invocations, chaînes, attaques, dégâts).
            - Déroulé : ce qui rythme (phases, tour, pioche, waiting).
            Sans cette séparation, une invocation cruciale se noyait dans la
            succession draw phase / standby phase / main phase 1. */}
        <JournalPanel log={log} tab={logTab} onTab={setLogTab} />
      </div>

      {/* ── Menu contextuel bufferisé (§4bis)
          RIEN n'est envoyé au serveur tant que Valider n'est pas cliqué. */}
      {cardMenu && (
        <CardActionMenu
          menu={cardMenu}
          busy={busy}
          onPick={(id) =>
            setCardMenu((cur) => (cur ? { ...cur, pickedId: id } : cur))
          }
          onValidate={() => {
            if (!cardMenu.pickedId) return;
            // Confirmation Phase de Fin — §C.3.
            if (cardMenu.pickedId === 'toep' && shouldConfirmEndTurn()) {
              const optionId = cardMenu.pickedId;
              setCardMenu(null);
              setEndTurnConfirm({ optionId });
              return;
            }
            void send([cardMenu.pickedId]);
          }}
          onCancel={() => setCardMenu(null)}
        />
      )}

      {/* ── Contenu d'une zone (mon Extra/Cimetière/Bannies, ou Extra/Cimetière adverse §C.4) */}
      {openZone && (
        <Overlay onClose={() => setOpenZone(null)}>
          <h4 style={{ margin: '0 0 12px', color: 'var(--cyan)' }}>
            {openZone.side === 'foe' ? "Adversaire · " : ''}
            {openZone.kind === 'extra'
              ? 'Extra Deck'
              : openZone.kind === 'grave'
                ? 'Cimetière'
                : 'Bannies'}
          </h4>
          <CardGrid
            cards={(() => {
              const side = openZone.side === 'me' ? board.me : board.opponent;
              if (openZone.kind === 'grave') return side.graveyard;
              if (openZone.kind === 'banished') return side.banished;
              return []; // Extra Deck : moteur ne le retourne pas via queryZone en clair
            })()}
            emptyLabel={
              openZone.kind === 'extra'
                ? `${(openZone.side === 'me' ? board.me : board.opponent).extraCount} carte(s) — contenu masqué tant qu'elles ne sont pas révélées.`
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
          <h4 style={{ margin: '0 0 4px', color: 'var(--gold)' }}>
            {prompt.hint?.title ?? prompt.message}
          </h4>
          {/* §C.2 : indication de portée — le joueur voit à combien de cibles
              il a droit et pourquoi (via le hint, quand disponible). Sans ça,
              on cliquait au petit bonheur sur des cartes en espérant que le
              moteur accepte. */}
          {(prompt.kind === 'cards' || prompt.kind === 'sort') && (
            <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--gold)' }}>
              {prompt.min === prompt.max
                ? `Sélectionne exactement ${prompt.min} cible${prompt.min > 1 ? 's' : ''}`
                : `Sélectionne entre ${prompt.min} et ${prompt.max} cibles`}
            </p>
          )}
          {prompt.hint?.note && (
            <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--cyan)' }}>
              {prompt.hint.note}
            </p>
          )}
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

      {/* ── Cartes révélées par CONFIRM_CARDS / _DECKTOP / _EXTRATOP */}
      <RevealOverlay reveals={state.reveals ?? []} />

      {/* ── Retrait de marqueurs (SELECT_COUNTER) */}
      {prompt?.kind === 'select_counter' && prompt.counter && (
        <CounterModal
          prompt={prompt}
          busy={busy}
          onConfirm={(counters) => send([], false, { counters })}
        />
      )}

      {/* ── Déclaration d'une carte (ANNOUNCE_CARD) */}
      {prompt?.kind === 'announce_card' && (
        <AnnounceCardModal
          duelId={duelId}
          busy={busy}
          onConfirm={(code) => send([], false, { announcedCode: code })}
        />
      )}

      {/* ── Lancers de pièce / dés (MSG_TOSS_COIN, MSG_TOSS_DICE) */}
      <TossOverlay tosses={state.tosses ?? []} />

      {/* ── Narration de combat (attaques, damage steps, effets ratés) */}
      <CombatLogFeed entries={state.combatLog ?? []} />

      {/* ── Animations §3.2 : mouvements, marqueurs, invocations spéciales.
          Le composant écoute state.animations, filtrées par siège côté serveur,
          et applique les effets CSS sans dépendance externe. */}
      <AnimationLayer animations={state.animations ?? []} />

      {/* ── Confirmation « Terminer ton tour ? » §C.3 */}
      {endTurnConfirm && (
        <Overlay onClose={() => setEndTurnConfirm(null)}>
          <h4 style={{ margin: '0 0 6px', color: 'var(--gold)' }}>Terminer ton tour ?</h4>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>
            {board.phase === 'main1' && board.me.hand.length > 0
              ? `Il te reste ${board.me.hand.length} carte(s) en main.`
              : "Certains de tes monstres n'ont pas encore attaqué."}
          </p>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--text-muted)',
              marginBottom: 14,
              cursor: 'pointer',
            }}>
            <input
              type="checkbox"
              checked={endTurnMuted}
              onChange={(e) => setEndTurnMuted(e.target.checked)}
            />
            Ne plus demander cette partie
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const optionId = endTurnConfirm.optionId;
                setEndTurnConfirm(null);
                void send([optionId]);
              }}
              style={btn('var(--gold)')}>
              Confirmer
            </button>
            <button type="button" onClick={() => setEndTurnConfirm(null)} style={ghostBtn}>
              Non, je continue
            </button>
          </div>
        </Overlay>
      )}

      {/* ── Détail au survol */}
      {hovered && hovered.code > 0 && <HoverCard card={hovered} />}
    </div>
  );
}

// ─── Pile ou face — écran avant l'ouverture du moteur ───────────────────────

function PreGameScreen({
  preGame,
  userId,
  busy,
  onFlip,
  onChoice,
  onBack,
}: {
  preGame: DuelPreGameState;
  /** Passé au composant à titre informatif, non utilisé pour l'instant — cartouche d'adversaire prévu plus tard. */
  duel: Duel | null;
  userId: number | null;
  busy: boolean;
  onFlip: () => void;
  onChoice: (choice: 'P1' | 'P2') => void;
  onBack: () => void;
}) {
  const me = userId;
  const isWinner = preGame.winnerId === me;
  const iAlreadyClicked = me !== null && preGame.playersReady.includes(me);

  // Compte à rebours de choix (30 s). On resynchronise chaque seconde plutôt
  // que sur `setTimeout(deadline - now)` pour ne pas geler quand l'onglet
  // reprend le focus après un moment.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (preGame.phase !== 'awaiting_choice') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [preGame.phase]);

  const remainingSec =
    preGame.phase === 'awaiting_choice' && preGame.choiceDeadlineAt
      ? Math.max(0, Math.floor((preGame.choiceDeadlineAt - now) / 1000))
      : null;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        gap: 24,
        background: 'radial-gradient(circle at top, rgba(245,197,24,.06), transparent 60%)',
      }}>
      <button type="button" onClick={onBack} style={{ ...ghostBtn, position: 'absolute', top: 16, left: 16 }}>
        ← Retour
      </button>

      <div style={{ ...panel, minWidth: 380, maxWidth: 520, textAlign: 'center' }}>
        <h2 style={{ margin: 0, color: 'var(--gold)', fontFamily: "'Orbitron', sans-serif" }}>
          {preGame.phase === 'awaiting_flip' && 'Pile ou face'}
          {preGame.phase === 'awaiting_choice' &&
            (isWinner ? 'Tu gagnes le pile ou face !' : "En attente de l'adversaire")}
          {preGame.phase === 'resolved' && 'C\'est parti'}
        </h2>

        <div style={{ margin: '18px 0', fontSize: 44 }}>
          <span
            style={{
              display: 'inline-block',
              animation:
                preGame.phase === 'awaiting_flip' && iAlreadyClicked
                  ? 'coin-spin 900ms linear infinite'
                  : undefined,
            }}>
            {preGame.phase === 'resolved' ? '⚔️' : '🪙'}
          </span>
        </div>

        {preGame.phase === 'awaiting_flip' && (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 12px' }}>
              Le vainqueur choisira de commencer ou non. Le tirage est fait côté serveur.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={busy || iAlreadyClicked}
                onClick={onFlip}
                style={btn(iAlreadyClicked ? 'var(--panel-2)' : 'var(--gold)')}>
                {iAlreadyClicked ? 'En attente…' : 'Lancer la pièce'}
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '14px 0 0' }}>
              {preGame.playersReady.length} / 2 joueur(s) prêt(s)
            </p>
          </>
        )}

        {preGame.phase === 'awaiting_choice' && isWinner && (
          <>
            <p style={{ color: 'var(--cyan)', fontSize: 13, margin: '0 0 14px' }}>
              Tu choisis qui commence.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onChoice('P1')}
                style={btn('var(--gold)')}>
                Jouer en 1er
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onChoice('P2')}
                style={btn('var(--violet)')}>
                Jouer en 2nd
              </button>
            </div>
            {remainingSec !== null && (
              <p
                style={{
                  color: remainingSec <= 10 ? 'var(--danger, #d84a4a)' : 'var(--text-muted)',
                  fontSize: 12,
                  margin: '14px 0 0',
                }}>
                Choix automatique dans {remainingSec}s
              </p>
            )}
          </>
        )}

        {preGame.phase === 'awaiting_choice' && !isWinner && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            L'adversaire choisit qui commence — reste avec nous.
            {remainingSec !== null && (
              <>
                <br />
                <span style={{ fontSize: 11 }}>Choix automatique dans {remainingSec}s</span>
              </>
            )}
          </p>
        )}

        {preGame.phase === 'resolved' && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            {preGame.firstPlayerId === userId ? 'Tu commences.' : "L'adversaire commence."}
          </p>
        )}
      </div>

      <style>{`
        @keyframes coin-spin {
          from { transform: rotateY(0deg); }
          to { transform: rotateY(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─── Chronomètres — chess-clock affiché dans le header ─────────────────────

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Affichage temps réel des deux chronos.
 *
 * Décompte local via `setInterval` pour ne pas attendre le prochain poll, mais
 * le point de référence est `clocks.serverNow` : on recale à chaque rendu.
 * Sans ça, deux clients afficheraient des chronos qui dérivent d'une seconde
 * chaque minute selon leurs horloges système.
 */
function ClockDisplay({
  clocks,
  mySeat,
}: {
  clocks: import('../../../shared/duelView').DuelClocks;
  mySeat: 0 | 1;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, []);

  const drift = Date.now() - clocks.serverNow;
  const runningIsMe = clocks.runningFor === mySeat;
  const runningIsOpp = clocks.runningFor !== null && clocks.runningFor !== mySeat;
  const myMs = Math.max(0, clocks.p1Ms - (runningIsMe ? drift : 0));
  const oppMs = Math.max(0, clocks.p2Ms - (runningIsOpp ? drift : 0));

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }} title={`t=${tick}`}>
      <ClockPill label="Toi" ms={myMs} running={runningIsMe} />
      <ClockPill label="Adv." ms={oppMs} running={runningIsOpp} />
    </div>
  );
}

function ClockPill({ label, ms, running }: { label: string; ms: number; running: boolean }) {
  const low = ms < 120_000;
  const critical = ms < 30_000;
  const color = critical ? 'var(--danger, #d84a4a)' : low ? 'var(--gold)' : 'var(--text)';
  return (
    <div
      style={{
        padding: '4px 10px',
        border: `1px solid ${running ? color : 'var(--border)'}`,
        color,
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 13,
        letterSpacing: '0.06em',
        animation: critical && running ? 'clock-pulse 900ms ease-in-out infinite' : undefined,
        opacity: running ? 1 : 0.75,
      }}>
      <span style={{ fontSize: 9, opacity: 0.6 }}>{label} </span>
      {formatMs(ms)}
      <style>{`
        @keyframes clock-pulse {
          0%, 100% { box-shadow: 0 0 0 rgba(216,74,74,0); }
          50% { box-shadow: 0 0 10px rgba(216,74,74,.65); }
        }
      `}</style>
    </div>
  );
}

// ─── Superposition des lancers de pièce / dés ──────────────────────────────

function TossOverlay({ tosses }: { tosses: DuelTossEvent[] }) {
  const [alive, setAlive] = useState<DuelTossEvent[]>([]);
  useEffect(() => {
    setAlive((prev) => {
      const seen = new Set(prev.map((t) => `${t.at}:${t.kind}`));
      return [...prev, ...tosses.filter((t) => !seen.has(`${t.at}:${t.kind}`))];
    });
  }, [tosses]);
  useEffect(() => {
    if (!alive.length) return;
    const t = setTimeout(
      () => setAlive((prev) => prev.filter((x) => Date.now() - x.at < x.ttl)),
      600
    );
    return () => clearTimeout(t);
  }, [alive]);

  if (!alive.length) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '35%',
        left: 0,
        right: 0,
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'none',
        zIndex: 7600,
      }}>
      {alive.map((toss) => {
        const label = toss.kind === 'coin' ? 'Pile ou face' : 'Lancer de dés';
        const values =
          toss.kind === 'coin'
            ? toss.results.map((r) => (r ? 'FACE' : 'PILE')).join(' · ')
            : toss.results.join(' · ');
        const glyph = toss.kind === 'coin' ? '🪙' : '🎲';
        return (
          <div
            key={`${toss.at}:${toss.kind}`}
            style={{
              display: 'grid',
              justifyItems: 'center',
              gap: 4,
              padding: '16px 24px',
              background: 'rgba(11,9,6,.9)',
              border: '2px solid var(--gold)',
              boxShadow: '0 0 40px rgba(245,197,24,.35)',
              fontFamily: "'Orbitron', sans-serif",
            }}>
            <span style={{ fontSize: 34 }}>{glyph}</span>
            <span style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--gold)' }}>{label}</span>
            <strong style={{ fontSize: 22, color: 'var(--cyan)' }}>{values}</strong>
          </div>
        );
      })}
    </div>
  );
}

// ─── Flux narratif du combat ───────────────────────────────────────────────

function CombatLogFeed({ entries }: { entries: DuelCombatLogEntry[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const [toasts, setToasts] = useState<DuelCombatLogEntry[]>([]);
  const seen = useRef<Set<string>>(new Set());

  // Toast bref au centre pour les événements qui méritent l'attention.
  useEffect(() => {
    const attention = new Set(['missed_effect', 'chain_negated', 'chain_disabled', 'attack_disabled']);
    for (const e of entries) {
      const k = `${e.at}:${e.kind}`;
      if (seen.current.has(k)) continue;
      seen.current.add(k);
      if (attention.has(e.kind)) {
        setToasts((prev) => [...prev, e]);
      }
    }
  }, [entries]);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((prev) => prev.slice(1)), 2500);
    return () => clearTimeout(t);
  }, [toasts]);

  return (
    <>
      <aside
        style={{
          position: 'fixed',
          top: 78,
          left: 16,
          width: collapsed ? 44 : 240,
          maxHeight: '46vh',
          padding: 10,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          transition: 'width 200ms ease',
          zIndex: 6000,
        }}>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          style={{
            ...ghostBtn,
            padding: '4px 8px',
            fontSize: 10,
            width: '100%',
            marginBottom: 8,
          }}>
          {collapsed ? '⚔' : 'Combat ▾'}
        </button>
        {!collapsed && (
          <div style={{ display: 'grid', gap: 4, maxHeight: '38vh', overflowY: 'auto' }}>
            {entries.length === 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Aucun combat encore.</span>
            )}
            {[...entries].reverse().map((e, i) => (
              <div
                key={`${e.at}-${i}`}
                style={{
                  fontSize: 11,
                  color:
                    e.kind === 'missed_effect' ||
                    e.kind === 'chain_negated' ||
                    e.kind === 'attack_disabled'
                      ? 'var(--danger, #d84a4a)'
                      : 'var(--text-muted)',
                }}>
                <span style={{ color: 'var(--magenta)' }}>›</span> {e.description}
              </div>
            ))}
          </div>
        )}
      </aside>

      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: '18%',
            left: 0,
            right: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
            zIndex: 7700,
          }}>
          {toasts.slice(0, 1).map((t) => (
            <div
              key={`${t.at}:${t.kind}`}
              style={{
                padding: '10px 20px',
                background: 'rgba(11,9,6,.9)',
                border: '2px solid var(--danger, #d84a4a)',
                color: 'var(--danger, #d84a4a)',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 14,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}>
              {t.description}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Sous-composants ────────────────────────────────────────────────────────

/**
 * Retrait de marqueurs — un curseur par carte, contrainte de somme.
 *
 * Le moteur exige que **la somme des retraits égale exactement** le total
 * demandé, sans dépasser les marqueurs disponibles sur chaque carte. On désamorce
 * le bouton « Valider » tant que ce n'est pas vérifié : envoyer avant coup
 * ferait remonter un `RETRY` qu'on chercherait à décoder à la main.
 */
function CounterModal({
  prompt,
  busy,
  onConfirm,
}: {
  prompt: DuelPrompt;
  busy: boolean;
  onConfirm: (counters: Array<{ targetIdx: number; take: number }>) => void;
}) {
  const c = prompt.counter!;
  const [values, setValues] = useState<number[]>(() => c.targets.map(() => 0));
  const total = values.reduce((s, v) => s + v, 0);
  const enough = total === c.count;

  return (
    <Overlay onClose={() => undefined}>
      <h4 style={{ margin: '0 0 4px', color: 'var(--gold)' }}>{prompt.message}</h4>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>
        Type de marqueur : {c.counterName} · à retirer : <strong>{c.count}</strong>{' '}
        (choisi : {total})
      </p>
      <div style={{ display: 'grid', gap: 10, marginBottom: 14, minWidth: 320 }}>
        {c.targets.map((t, i) => (
          <div
            key={`${t.cardCode}-${i}`}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: 12,
              alignItems: 'center',
              padding: 8,
              border: '1px solid var(--border)',
              background: 'var(--panel-2)',
            }}>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>
              {t.cardName} <span style={{ color: 'var(--text-muted)' }}>({t.currentCount})</span>
            </span>
            <input
              type="range"
              min={0}
              max={t.currentCount}
              value={values[i]}
              onChange={(e) => {
                const v = Math.max(0, Math.min(t.currentCount, Number(e.target.value)));
                setValues((cur) => cur.map((x, k) => (k === i ? v : x)));
              }}
              style={{ width: '100%' }}
            />
            <input
              type="number"
              min={0}
              max={t.currentCount}
              value={values[i]}
              onChange={(e) => {
                const v = Math.max(0, Math.min(t.currentCount, Number(e.target.value) || 0));
                setValues((cur) => cur.map((x, k) => (k === i ? v : x)));
              }}
              style={{
                width: 58,
                padding: '4px 6px',
                background: 'var(--bg-elev)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={busy || !enough}
          onClick={() =>
            onConfirm(
              values
                .map((take, targetIdx) => ({ targetIdx, take }))
                .filter((x) => x.take > 0)
            )
          }
          style={btn(enough ? 'var(--cyan)' : 'var(--panel-2)')}>
          {enough ? 'Retirer' : `Encore ${c.count - total} à choisir`}
        </button>
      </div>
    </Overlay>
  );
}

/**
 * Déclaration d'une carte — recherche typeahead.
 *
 * L'énumération complète (14 714 cartes) n'est pas servie ; on interroge le
 * serveur au fil de la frappe. Le résultat est déjà filtré par les opcodes du
 * moteur — pas besoin de deuxième vérification côté client. Débounce à 200 ms
 * pour ne pas noyer l'API à chaque touche.
 */
function AnnounceCardModal({
  duelId,
  busy,
  onConfirm,
}: {
  duelId: number;
  busy: boolean;
  onConfirm: (code: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DuelAnnounceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      duelEngineApi
        .announceSearch(duelId, q)
        .then((rs) => setResults(rs))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query, duelId]);

  return (
    <Overlay onClose={() => undefined}>
      <h4 style={{ margin: '0 0 6px', color: 'var(--gold)' }}>Déclare une carte</h4>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>
        Tape le début du nom. Le moteur filtre déjà les cartes non déclarables :
        seules celles qu'il acceptera sont proposées.
      </p>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Nom de la carte…"
        maxLength={64}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'var(--bg-elev)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          fontSize: 14,
          marginBottom: 12,
        }}
      />
      <div
        style={{
          display: 'grid',
          gap: 4,
          maxHeight: 320,
          overflowY: 'auto',
          minWidth: 340,
          marginBottom: 4,
        }}>
        {searching && (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Recherche…</span>
        )}
        {!searching && query.trim().length < 2 && (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Deux caractères minimum.
          </span>
        )}
        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Aucune carte ne correspond ET ne passe le filtre du moteur.
          </span>
        )}
        {results.map((r) => (
          <button
            key={r.code}
            type="button"
            disabled={busy}
            onClick={() => onConfirm(r.code)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: 6,
              background: 'var(--panel-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              cursor: 'pointer',
              textAlign: 'left',
            }}>
            <img
              src={`https://images.ygoprodeck.com/images/cards_small/${r.code}.jpg`}
              alt=""
              style={{ width: 32, height: 46, objectFit: 'cover' }}
            />
            <span style={{ fontSize: 13 }}>{r.name}</span>
          </button>
        ))}
      </div>
    </Overlay>
  );
}

/**
 * Superpose les cartes révélées à l'adversaire, en fade-in / fade-out.
 *
 * Les révélations sont **transitoires** : elles ne modifient pas l'état du
 * plateau (une carte face cachée ne devient pas face visible parce qu'on l'a
 * montrée), elles racontent seulement ce qui vient de se passer. Le serveur
 * les fait expirer à 6 s ; ici on suit ce TTL pour éviter qu'un rafraîchissement
 * ne les repioche indéfiniment.
 */
function RevealOverlay({ reveals }: { reveals: DuelRevealBatch[] }) {
  const [alive, setAlive] = useState<DuelRevealBatch[]>([]);
  // On garde l'ensemble courant, indexé par (at, forPlayer) pour éviter le
  // clignotement lors des polls successifs qui revoient la même batch.
  useEffect(() => {
    setAlive((prev) => {
      const seen = new Set(prev.map((r) => `${r.at}:${r.forPlayer}`));
      const additions = reveals.filter((r) => !seen.has(`${r.at}:${r.forPlayer}`));
      return [...prev, ...additions];
    });
  }, [reveals]);

  useEffect(() => {
    if (alive.length === 0) return;
    const now = Date.now();
    const soonest = Math.min(...alive.map((r) => r.at + r.ttl - now));
    const t = setTimeout(
      () => setAlive((prev) => prev.filter((r) => Date.now() - r.at < r.ttl)),
      Math.max(200, soonest)
    );
    return () => clearTimeout(t);
  }, [alive]);

  if (alive.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 84,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        gap: 14,
        zIndex: 7500,
        pointerEvents: 'none',
      }}>
      {alive.map((batch) => {
        const elapsed = Date.now() - batch.at;
        const opacity =
          elapsed < 300
            ? elapsed / 300
            : elapsed > batch.ttl - 600
              ? Math.max(0, (batch.ttl - elapsed) / 600)
              : 1;
        return (
          <div
            key={`${batch.at}:${batch.forPlayer}`}
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
              padding: 10,
              background: 'rgba(11, 9, 6, 0.85)',
              border: '1px solid var(--gold)',
              boxShadow: '0 8px 24px rgba(0,0,0,.6), 0 0 24px rgba(245,197,24,.25)',
              opacity,
              transition: 'opacity 200ms linear',
            }}>
            <span
              style={{
                writingMode: 'vertical-rl',
                fontSize: 9,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--gold)',
              }}>
              Révélation
            </span>
            {batch.cards.map((card, i) => {
              const zoneBadge =
                card.from === 'decktop'
                  ? 'Deck (dessus)'
                  : card.from === 'extratop'
                    ? 'Extra (dessus)'
                    : card.from === 'hand'
                      ? 'Main'
                      : card.from === 'deck'
                        ? 'Deck'
                        : card.from === 'grave'
                          ? 'Cimetière'
                          : card.from === 'extra'
                            ? 'Extra'
                            : card.from === 'field'
                              ? 'Terrain'
                              : null;
              return (
                <div key={`${card.code}-${i}`} style={{ display: 'grid', gap: 4, textAlign: 'center' }}>
                  <img
                    src={`https://images.ygoprodeck.com/images/cards_small/${card.code}.jpg`}
                    alt={card.name ?? ''}
                    style={{ width: 84, border: '1px solid var(--gold)' }}
                  />
                  {zoneBadge && (
                    <span
                      style={{
                        fontSize: 9,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color:
                          card.from === 'decktop' || card.from === 'extratop'
                            ? 'var(--cyan)'
                            : 'var(--text-muted)',
                        padding: '2px 4px',
                        background:
                          card.from === 'decktop' || card.from === 'extratop'
                            ? 'rgba(34,211,238,.12)'
                            : 'transparent',
                      }}>
                      {zoneBadge}
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: 'var(--text)', maxWidth: 84 }}>
                    {card.name ?? `#${card.code}`}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

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

/**
 * Rail de la chaîne active — pile ordonnée des maillons, avec le maillon en
 * cours de résolution en surbrillance dorée.
 *
 * Ordre d'affichage : bas de la pile en haut de la liste (premier activé),
 * dernier maillon en bas — ce que le joueur voit se résoudre par le sommet.
 * En YGO la résolution est LIFO ; visuellement, on regarde donc de bas en haut.
 */
function ChainPanel({
  chain,
  solvingLink,
  mySeat,
}: {
  chain: import('../../../shared/duelView').DuelChainEntry[];
  solvingLink: number | null;
  mySeat: 0 | 1;
}) {
  return (
    <aside
      style={{
        display: 'grid',
        gap: 6,
        width: 128,
        alignSelf: 'center',
        padding: 8,
        border: '1px solid var(--magenta)',
        borderRadius: 6,
        background: 'rgba(184, 46, 133, .08)',
      }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--magenta)',
          fontWeight: 700,
          textAlign: 'center',
        }}>
        Chaîne · {chain.length}
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {chain.map((link) => {
          const solving = solvingLink === link.link;
          const mine = link.controller === mySeat;
          return (
            <div
              key={`chain-${link.link}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 6px',
                border: `1px solid ${solving ? 'var(--gold)' : 'var(--border)'}`,
                borderRadius: 4,
                background: solving ? 'rgba(245,197,24,.18)' : 'var(--panel-2)',
                boxShadow: solving ? '0 0 8px rgba(245,197,24,.5)' : 'none',
              }}
              title={`Maillon #${link.link} — ${mine ? 'toi' : 'adversaire'}`}>
              <img
                src={`https://images.ygoprodeck.com/images/cards_small/${link.code}.jpg`}
                alt={link.name ?? ''}
                style={{ width: 24, height: 35, objectFit: 'cover', flexShrink: 0 }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.06em',
                  }}>
                  #{link.link} {mine ? 'moi' : 'adv.'}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: solving ? 'var(--gold)' : 'var(--text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                  {link.name ?? `Carte ${link.code}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {solvingLink !== null && (
        <div
          style={{
            fontSize: 9,
            color: 'var(--gold)',
            textAlign: 'center',
            letterSpacing: '0.06em',
          }}>
          Résolution en cours
        </div>
      )}
    </aside>
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
/**
 * Aperçu au survol, au centre de l'écran.
 *
 * Une vignette de 64 px ne permet ni de lire un texte d'effet, ni de distinguer
 * deux cartes d'un même archétype. L'aperçu montre donc **l'illustration en
 * grand**, et le texte dessous.
 *
 * `pointerEvents: none` sur l'ensemble : l'aperçu se superpose au plateau, et
 * s'il interceptait la souris il chasserait le survol qui l'a fait apparaître —
 * il clignoterait sans fin.
 */
function HoverCard({ card }: { card: DuelCardView }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        zIndex: 8000,
        pointerEvents: 'none',
      }}>
      <div
        style={{
          display: 'grid',
          justifyItems: 'center',
          gap: 12,
          maxWidth: 340,
          animation: 'san-announce-still 140ms ease-out both',
        }}>
        <img
          src={`https://images.ygoprodeck.com/images/cards/${card.code}.jpg`}
          alt={card.name ?? ''}
          style={{
            width: 260,
            border: '1px solid var(--gold)',
            boxShadow: '0 18px 50px rgba(0,0,0,.75), 0 0 40px rgba(245,197,24,.25)',
          }}
        />

        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--gold)',
            borderLeftWidth: 3,
            padding: '12px 14px',
            width: '100%',
            boxShadow: '0 12px 32px rgba(0,0,0,.6)',
          }}>
          <strong style={{ color: 'var(--gold)', fontSize: 14 }}>{card.name}</strong>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 8px' }}>
            {card.level !== undefined && `Niveau ${card.level}`}
            {card.attack !== undefined && ` · ATK ${card.attack}`}
            {card.defense !== undefined && ` · DEF ${card.defense}`}
            {card.materials ? ` · ${card.materials} matériau(x)` : ''}
          </div>
          {card.description && (
            <p
              style={{
                fontSize: 12,
                color: 'var(--text)',
                margin: 0,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                maxHeight: 180,
                overflowY: 'auto',
              }}>
              {card.description}
            </p>
          )}
        </div>
      </div>
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

// ─── §4bis : menu contextuel bufferisé ───────────────────────────────────────

/**
 * Menu contextuel d'une carte, sans envoi immédiat.
 *
 * Chaque option est un bouton radio ; « Valider » (or) transmet le choix au
 * serveur, « Annuler » (ghost) ferme sans rien envoyer. Ce dernier point est
 * la garantie forte du §4bis : contrairement à Master Duel, l'adversaire ne
 * voit rien tant que le joueur n'a pas validé — parce que rien n'a été envoyé
 * au serveur, donc aucun broadcast n'a eu lieu.
 */
function CardActionMenu({
  menu,
  busy,
  onPick,
  onValidate,
  onCancel,
}: {
  menu: { title: string; card: DuelCardView | null; options: DuelPromptOption[]; pickedId: string | null };
  busy: boolean;
  onPick: (id: string) => void;
  onValidate: () => void;
  onCancel: () => void;
}) {
  return (
    <Overlay onClose={onCancel}>
      <h4 style={{ margin: '0 0 4px', color: 'var(--gold)' }}>{menu.title}</h4>
      <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--text-muted)' }}>
        L'adversaire ne voit rien tant que tu n'as pas cliqué Valider.
      </p>
      <div style={{ display: 'grid', gap: 8, marginBottom: 14, minWidth: 280 }}>
        {menu.options.map((o) => {
          const picked = menu.pickedId === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={busy}
              onClick={() => onPick(o.id)}
              style={{
                ...btn(picked ? 'var(--gold)' : 'var(--panel-2)'),
                color: picked ? 'var(--on-gold)' : 'var(--text)',
                border: `1px solid ${picked ? 'var(--gold)' : 'var(--border)'}`,
                textAlign: 'left',
              }}>
              {o.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={busy || !menu.pickedId}
          onClick={onValidate}
          style={{
            ...btn(menu.pickedId ? 'var(--gold)' : 'var(--panel-2)'),
            opacity: menu.pickedId ? 1 : 0.5,
          }}>
          Valider
        </button>
        <button type="button" disabled={busy} onClick={onCancel} style={ghostBtn}>
          Annuler
        </button>
      </div>
    </Overlay>
  );
}

// ─── §C.1 : journal à onglets — Actions vs Déroulé ─────────────────────────

/**
 * Panneau du journal, avec deux onglets pour ne pas noyer les actions dans
 * les changements de phase.
 *
 * - « Actions » : invocations, chaînes, attaques, dégâts.
 * - « Déroulé » : tour, phase, pioche, hints textuels.
 *
 * La catégorisation se fait par `kind` — décorrélée du serveur pour que la
 * séparation soit modifiable sans nouveau round-trip. Un événement absent des
 * deux catégories tombe dans « Déroulé » par défaut.
 */
const ACTION_KINDS = new Set([
  'summoning',
  'spsummoning',
  'flipsummoning',
  'chaining',
  'attack',
  'set',
  'damage',
  'recover',
  'pay_lpcost',
  'win',
  'toss_coin',
  'toss_dice',
]);
const FLOW_KINDS = new Set(['new_turn', 'new_phase', 'draw', 'hint']);

function categorizeLog(entry: DuelLogEntry): 'actions' | 'flow' {
  if (ACTION_KINDS.has(entry.kind)) return 'actions';
  if (FLOW_KINDS.has(entry.kind)) return 'flow';
  return 'flow';
}

function JournalPanel({
  log,
  tab,
  onTab,
}: {
  log: DuelLogEntry[];
  tab: 'actions' | 'flow';
  onTab: (t: 'actions' | 'flow') => void;
}) {
  const filtered = log.filter((e) => categorizeLog(e) === tab);
  const tabBtn = (_label: string, key: 'actions' | 'flow', accent: string): React.CSSProperties => ({
    padding: '4px 10px',
    background: tab === key ? accent : 'transparent',
    color: tab === key ? 'var(--on-gold)' : 'var(--text-muted)',
    border: `1px solid ${tab === key ? accent : 'var(--border)'}`,
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: "'Orbitron', sans-serif",
    fontWeight: 700,
  });
  return (
    <aside
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        padding: 12,
        position: 'fixed',
        top: 78,
        right: 16,
        width: 290,
        maxHeight: '46vh',
        overflow: 'hidden',
        clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)',
      }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button type="button" style={tabBtn('Actions', 'actions', 'var(--gold)')} onClick={() => onTab('actions')}>
          Actions
        </button>
        <button type="button" style={tabBtn('Déroulé', 'flow', 'var(--violet)')} onClick={() => onTab('flow')}>
          Déroulé
        </button>
      </div>
      <div style={{ display: 'grid', gap: 4, maxHeight: '38vh', overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            {tab === 'actions' ? 'Aucune action encore.' : 'Rien encore.'}
          </span>
        )}
        {[...filtered].reverse().map((entry, i) => (
          <div
            key={i}
            style={{
              fontSize: 12,
              color: tab === 'actions' ? 'var(--text)' : 'var(--text-muted)',
            }}>
            <span style={{ color: tab === 'actions' ? 'var(--gold)' : 'var(--violet)' }}>›</span>{' '}
            {entry.text}
          </div>
        ))}
      </div>
    </aside>
  );
}

// ─── §3.2 : couche d'animations ──────────────────────────────────────────────

/**
 * Superpose les animations du plateau (mouvements, marqueurs, invocations,
 * chaîne, pioche) en TTL court. Chaque animation apparaît dans le coin
 * supérieur droit, s'estompe puis disparaît une fois expirée.
 *
 * Pas de dépendance externe : seules CSS transitions et requestAnimationFrame.
 * Les événements sont dédupliqués sur `at + kind + description` pour ne pas
 * les rejouer à chaque poll.
 *
 * Les événements type `draw` déclenchent en plus une animation de carte qui
 * glisse du deck vers la main via les keyframes `san-draw-card` (§F3).
 */
function AnimationLayer({ animations }: { animations: DuelAnimationEvent[] }) {
  const [alive, setAlive] = useState<DuelAnimationEvent[]>([]);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const additions: DuelAnimationEvent[] = [];
    for (const a of animations) {
      const k = `${a.at}:${a.kind}:${a.description}`;
      if (seen.current.has(k)) continue;
      seen.current.add(k);
      additions.push(a);
    }
    if (additions.length) setAlive((prev) => [...prev, ...additions]);
  }, [animations]);

  useEffect(() => {
    if (!alive.length) return;
    const t = setInterval(() => {
      const now = Date.now();
      setAlive((prev) => prev.filter((a) => now - a.at < a.ttl));
    }, 400);
    return () => clearInterval(t);
  }, [alive]);

  const drawEvents = alive.filter((a) => a.kind === 'draw' && (a.count ?? 0) > 0);
  const otherEvents = alive.filter((a) => a.kind !== 'draw');

  return (
    <>
      {/* Bandeau des micro-narrations d'animations */}
      {otherEvents.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 78,
            right: 320,
            display: 'grid',
            gap: 4,
            maxWidth: 240,
            pointerEvents: 'none',
            zIndex: 6500,
          }}>
          {otherEvents.slice(-6).map((a) => {
            const elapsed = Date.now() - a.at;
            const opacity = Math.max(0, 1 - elapsed / a.ttl);
            const accent = animationAccent(a.kind, a.variant);
            return (
              <div
                key={`${a.at}:${a.kind}:${a.description}`}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(11,9,6,.85)',
                  border: `1px solid ${accent}`,
                  color: accent,
                  fontSize: 11,
                  fontFamily: "'Orbitron', sans-serif",
                  letterSpacing: '0.06em',
                  opacity,
                  transition: 'opacity 200ms linear',
                }}>
                <span style={{ opacity: 0.7, fontSize: 9, marginRight: 6 }}>
                  {animationGlyph(a.kind, a.variant)}
                </span>
                {a.description}
              </div>
            );
          })}
        </div>
      )}

      {/* Animation de pioche §F3 — les cartes glissent du deck vers la main */}
      {drawEvents.map((a) => (
        <DrawAnimation key={`draw:${a.at}:${a.controller}`} event={a} />
      ))}
    </>
  );
}

/** Couleur/type d'animation, pour la lisibilité — cyan Xyz, or Synchro, violet Link. */
function animationAccent(kind: string, variant?: string): string {
  if (kind === 'spsummoned') {
    if (variant === 'xyz') return 'var(--cyan)';
    if (variant === 'link') return 'var(--violet)';
    if (variant === 'synchro') return 'var(--gold)';
    if (variant === 'fusion') return 'var(--magenta)';
    return 'var(--gold)';
  }
  if (kind === 'become_target' || kind === 'card_target') return 'var(--danger, #d84a4a)';
  if (kind === 'add_counter' || kind === 'remove_counter') return 'var(--gold)';
  if (kind === 'chained' || kind === 'chain_solving' || kind === 'chain_solved' || kind === 'chain_end')
    return 'var(--magenta)';
  if (kind === 'shuffle_hand' || kind === 'shuffle_deck' || kind === 'shuffle_extra')
    return 'var(--cyan)';
  return 'var(--text-muted)';
}

function animationGlyph(kind: string, variant?: string): string {
  if (kind === 'spsummoned') {
    if (variant === 'xyz') return '◈';
    if (variant === 'link') return '◇';
    if (variant === 'synchro') return '☼';
    if (variant === 'fusion') return '✧';
    return '★';
  }
  if (kind === 'summoned') return '✦';
  if (kind === 'flipsummoned') return '⟳';
  if (kind === 'move' || kind === 'swap') return '⇄';
  if (kind === 'pos_change') return '⇅';
  if (kind === 'equip') return '⚔';
  if (kind === 'shuffle_hand' || kind === 'shuffle_deck' || kind === 'shuffle_extra') return '⌥';
  if (kind === 'deck_top') return '↑';
  if (kind === 'add_counter') return '＋';
  if (kind === 'remove_counter') return '−';
  if (kind === 'become_target' || kind === 'card_target') return '◎';
  if (kind === 'chained') return '⛓';
  if (kind === 'chain_solving' || kind === 'chain_solved') return '≈';
  if (kind === 'chain_end') return '∎';
  if (kind === 'field_disabled') return '⊘';
  if (kind === 'card_hint' || kind === 'player_hint') return '❢';
  return '·';
}

/**
 * Animation de pioche §F3 — chaque carte piochée glisse du deck vers la main.
 *
 * Le composant se sert des keyframes `san-draw-card` déjà posées dans
 * theme.css : `--draw-dx` / `--draw-dy` définissent la trajectoire.
 * On stagger les cartes de 80 ms pour ne pas les faire arriver toutes en
 * bloc — c'est plus lisible et ça met en valeur la pioche multiple.
 */
function DrawAnimation({ event }: { event: DuelAnimationEvent }) {
  const count = event.count ?? 0;
  if (count <= 0) return null;
  const codes = event.codes ?? [];
  return (
    <div
      style={{
        position: 'fixed',
        top: '52%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 6800,
        display: 'flex',
        gap: 8,
      }}>
      {Array.from({ length: count }).map((_, i) => {
        // Trajectoire : glisse de 200 px sur la droite (vers la main) tout en
        // s'estompant. Le stagger de 80 ms rend la séquence lisible en cas
        // de pioche multiple.
        const style: React.CSSProperties = {
          width: 68,
          height: 98,
          border: '1px solid var(--violet)',
          background:
            codes[i] !== undefined
              ? `url(https://images.ygoprodeck.com/images/cards_small/${codes[i]}.jpg) center/cover`
              : 'linear-gradient(180deg, var(--panel-2), var(--panel))',
          boxShadow: '0 0 20px rgba(140,90,255,.4)',
          animation: `san-draw-card 900ms ${i * 80}ms ease-out both`,
          ['--draw-dx' as string]: '220px',
          ['--draw-dy' as string]: '80px',
        };
        return <div key={`draw:${event.at}:${i}`} style={style} />;
      })}
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
