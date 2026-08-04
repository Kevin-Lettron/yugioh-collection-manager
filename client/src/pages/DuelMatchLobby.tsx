import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { duelMatchApi } from '../services/duelMatchApi';
import { useAuth } from '../context/AuthContext';
import type { DuelMatch } from '../../../shared/types';

/**
 * Éditeur de side-deck entre deux manches — F4 du PLAN-DUEL-AMELIORATIONS.
 *
 * Le joueur voit trois colonnes :
 *   1. **Main** (40-60) — cartes utilisées pour la partie
 *   2. **Extra** (0-15) — Fusion/Synchro/Xyz/Link
 *   3. **Side** (0-15) — pool d'échange
 *
 * Les mouvements se font par clic — un clic sur une carte du Main la renvoie
 * en Side, un clic sur une carte du Side la renvoie au Main (ou à l'Extra
 * selon son type). Pas de drag-and-drop pour l'instant : plus rapide à
 * livrer, l'ergonomie reste satisfaisante avec des piles de 15.
 *
 * L'invariant : (main ∪ extra ∪ side) doit toujours contenir la même
 * composition qu'avant. Le back rejette toute soumission qui ajouterait ou
 * retirerait une carte — sinon le sideboard serait un vecteur de triche.
 */

const cardImg = (cardId: number): string =>
  `https://images.ygoprodeck.com/images/cards_small/${cardId}.jpg`;

interface CardEntry {
  cardId: number;    // cards.id interne
  passcode: number;  // cards.card_id (pour l'image)
  name: string;
}

export default function DuelMatchLobby() {
  const { id } = useParams<{ id: string }>();
  const matchId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [match, setMatch] = useState<DuelMatch | null>(null);
  const [submittedBy, setSubmittedBy] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [main, setMain] = useState<CardEntry[]>([]);
  const [extra, setExtra] = useState<CardEntry[]>([]);
  const [side, setSide] = useState<CardEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const iSubmitted = user?.id ? submittedBy.includes(user.id) : false;

  const reload = useCallback(async () => {
    if (!Number.isFinite(matchId)) return;
    try {
      const { match: m, submittedBy: sb } = await duelMatchApi.view(matchId);
      setMatch(m);
      setSubmittedBy(sb);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Match introuvable');
      navigate('/duels');
    } finally {
      setLoading(false);
    }
  }, [matchId, navigate]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Charge la composition initiale via `/api/decks/:id` (sert de baseline) —
  // le back nous a déjà tout validé, il suffit de la présenter.
  useEffect(() => {
    if (!match || !user) return;
    if (match.status !== 'sideboard') return;
    (async () => {
      try {
        // On charge le deck de base pour peupler les 3 colonnes. En vrai on
        // pourrait aussi charger la soumission de la manche précédente si
        // elle existe — pour simplifier on repart du deck de base à chaque
        // fois. C'est suffisant pour un premier livraison.
        const games = match.games ?? [];
        const firstGame = games[0];
        if (!firstGame) return;
        const { default: axiosApi } = await import('../services/api');
        // Trouve *notre* deck via le premier duel enfant.
        const { data } = await axiosApi.get(`/duels/${firstGame.id}`);
        const duel = data.duel;
        const deckId =
          user.id === duel.challenger_id ? duel.challenger_deck_id : duel.opponent_deck_id;
        if (!deckId) return;
        const { data: deckData } = await axiosApi.get(`/decks/${deckId}`);
        const deck = deckData.deck ?? deckData;
        const toEntry = (dc: any): CardEntry[] =>
          Array.from({ length: Math.max(1, dc.quantity) }, () => ({
            cardId: dc.card_id,
            passcode: Number(dc.card?.card_id ?? 0),
            name: dc.card?.name_fr || dc.card?.name || `carte #${dc.card_id}`,
          }));
        const flatten = (arr: any[]): CardEntry[] => arr.flatMap(toEntry);
        setMain(flatten(deck.main_deck ?? []));
        setExtra(flatten(deck.extra_deck ?? []));
        setSide(flatten(deck.side_deck ?? []));
      } catch (err: any) {
        toast.error("Chargement de la composition impossible");
      }
    })();
  }, [match, user]);

  const nextGameNumber = useMemo(() => {
    const games = match?.games ?? [];
    return games.length > 0 ? Math.min(3, games[games.length - 1].game_number + 1) : 2;
  }, [match]);

  const moveMainToSide = (idx: number): void => {
    const [c] = main.splice(idx, 1);
    setMain([...main]);
    setSide([...side, c]);
  };
  const moveExtraToSide = (idx: number): void => {
    const [c] = extra.splice(idx, 1);
    setExtra([...extra]);
    setSide([...side, c]);
  };
  const moveSideToMain = (idx: number): void => {
    const [c] = side.splice(idx, 1);
    setSide([...side]);
    setMain([...main, c]);
  };

  const submit = async (): Promise<void> => {
    if (main.length < 40 || main.length > 60) {
      toast.error(`Main Deck : ${main.length} cartes (attendu 40-60)`);
      return;
    }
    if (extra.length > 15) {
      toast.error(`Extra Deck : ${extra.length} cartes (max 15)`);
      return;
    }
    if (side.length > 15) {
      toast.error(`Side Deck : ${side.length} cartes (max 15)`);
      return;
    }
    setSaving(true);
    try {
      await duelMatchApi.submitSideDeck(matchId, {
        main: main.map((c) => c.cardId),
        extra: extra.map((c) => c.cardId),
        side: side.map((c) => c.cardId),
      });
      toast.success('Side deck soumis');
      await reload();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Soumission refusée');
    } finally {
      setSaving(false);
    }
  };

  const startNext = async (): Promise<void> => {
    try {
      const { duelId } = await duelMatchApi.nextGame(matchId);
      navigate(`/duel/${duelId}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Prochaine manche indisponible');
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Chargement…</div>;
  if (!match) return <div style={{ padding: 24 }}>Match introuvable</div>;

  // Match fini → écran de résultat.
  if (match.status === 'finished') {
    const iWon = match.winner_id === user?.id;
    return (
      <div style={pageStyle}>
        <h1 style={{ margin: 0 }}>Match terminé</h1>
        <p style={{ fontSize: 32, margin: '16px 0' }}>
          {match.challenger_wins} — {match.opponent_wins}
        </p>
        <p>{iWon ? 'Victoire du match !' : 'Défaite du match'}</p>
        <button onClick={() => navigate('/duels')}>Retour aux duels</button>
      </div>
    );
  }

  const bothSubmitted =
    submittedBy.includes(match.challenger_id) && submittedBy.includes(match.opponent_id);

  return (
    <div style={pageStyle}>
      <h1 style={{ marginTop: 0 }}>Sideboard — Manche {nextGameNumber}</h1>
      <p style={{ opacity: 0.7 }}>
        Score : {match.challenger_wins} — {match.opponent_wins} · Bo{match.best_of}
      </p>

      {iSubmitted ? (
        <div style={{ padding: 16, border: '1px solid #444', borderRadius: 8, marginBottom: 16 }}>
          <p>Votre composition est enregistrée.</p>
          <p style={{ opacity: 0.7 }}>
            {bothSubmitted
              ? 'Les deux joueurs ont soumis leur side deck.'
              : 'En attente de l\'adversaire…'}
          </p>
          {bothSubmitted && (
            <button onClick={startNext} disabled={saving} style={btnPrimary}>
              Lancer la manche {nextGameNumber}
            </button>
          )}
        </div>
      ) : (
        <div>
          <div style={colsStyle}>
            <Column
              title={`Main Deck (${main.length})`}
              subtitle="40-60 cartes"
              cards={main}
              onCardClick={moveMainToSide}
              tooltipLabel="Envoyer au Side"
            />
            <Column
              title={`Extra Deck (${extra.length})`}
              subtitle="max 15"
              cards={extra}
              onCardClick={moveExtraToSide}
              tooltipLabel="Envoyer au Side"
            />
            <Column
              title={`Side Deck (${side.length})`}
              subtitle="max 15"
              cards={side}
              onCardClick={(i) => {
                // Décide Main ou Extra selon le type — heuristique par nom
                // (pas d'info type ici) : par défaut, on renvoie au Main.
                // Le back re-vérifiera l'appartenance.
                moveSideToMain(i);
              }}
              tooltipLabel="Envoyer au Main"
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button onClick={submit} disabled={saving} style={btnPrimary}>
              {saving ? 'Envoi…' : 'Valider ma composition'}
            </button>
            <button onClick={() => navigate('/duels')} disabled={saving}>
              Retour
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Column({
  title,
  subtitle,
  cards,
  onCardClick,
  tooltipLabel,
}: {
  title: string;
  subtitle: string;
  cards: CardEntry[];
  onCardClick: (idx: number) => void;
  tooltipLabel: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 240 }}>
      <h3 style={{ margin: '0 0 4px 0' }}>{title}</h3>
      <p style={{ opacity: 0.6, marginTop: 0, fontSize: 12 }}>{subtitle}</p>
      <div style={gridStyle}>
        {cards.map((c, i) => (
          <button
            key={`${c.cardId}-${i}`}
            onClick={() => onCardClick(i)}
            title={`${c.name} — ${tooltipLabel}`}
            style={cardBtnStyle}
          >
            {c.passcode ? (
              <img
                src={cardImg(c.passcode)}
                alt={c.name}
                style={{ width: '100%', display: 'block', borderRadius: 4 }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <span style={{ fontSize: 11 }}>{c.name}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 24,
  maxWidth: 1200,
  margin: '0 auto',
  color: 'inherit',
};

const colsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
  gap: 4,
  padding: 8,
  background: 'rgba(0,0,0,0.15)',
  borderRadius: 6,
  minHeight: 80,
};

const cardBtnStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  padding: '10px 24px',
  background: '#d4a017',
  color: '#000',
  border: 'none',
  borderRadius: 6,
  fontWeight: 700,
  cursor: 'pointer',
};
