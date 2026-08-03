import { useState, useEffect, FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Deck, DeckCard, DeckComment, DeckStats } from '../../../shared/types';
import api from '../services/api';
import toast from 'react-hot-toast';
import AppNavbar from '../components/AppNavbar';
import AppBackground from '../components/decor/AppBackground';
import CornerOrnaments from '../components/decor/CornerOrnaments';
import CardTile from '../components/decor/CardTile';
import { CardIcon } from '../components/decor/Icons';

const CUT_BTN = 'polygon(0 0,100% 0,100% 100%,95% 100%,95% 90%,85% 90%,85% 100%,8% 100%,0 70%)';
const CUT_SM = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';
const CUT_PANEL = 'polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px))';
const CUT_ARENA = 'polygon(0 0,calc(100% - 24px) 0,100% 24px,100% 100%,24px 100%,0 calc(100% - 24px))';
const CUT_ROW = 'polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%)';
const CUT_JAUGE = 'polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))';

/**
 * DeckView — deux variantes toggle : Arène (isArena l.211-300) / Grimoire (isList l.302-352).
 * - Arène : plateau 3D perspective(1100px), 5 back + 5 front zones, EXTRA/TERRAIN/CIMETIÈRE.
 * - Grimoire : jauge répartition + 3 colonnes Deck principal / Extra / Side avec rows biseautés.
 * Sidebar sticky : like/share/copier + deckMeta (« À venir » quand pas de data) + comments.
 */
const DeckView = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [stats, setStats] = useState<DeckStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<DeckComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [view, setView] = useState<'arena' | 'list'>('arena');

  // Test hand : simulation d'ouverture solo + placement sur le plateau.
  // Regles YGO : P1 pioche 5 (pas de draw au T1), P2 pioche 6.
  // Zones : 5 monstres (back), 5 magies/pieges (front), 1 terrain.
  const [playMode, setPlayMode] = useState<'first' | 'second' | null>(null);
  const [handCards, setHandCards] = useState<DeckCard[]>([]);
  const [deckPile, setDeckPile] = useState<DeckCard[]>([]);
  const [graveyard, setGraveyard] = useState<DeckCard[]>([]);
  const [banished, setBanished] = useState<DeckCard[]>([]);
  const [selectedHandIdx, setSelectedHandIdx] = useState<number | null>(null);
  /** Chaque zone stocke la carte + si elle est posée face cachée ("set" en jargon YGO). */
  type BoardCard = { card: DeckCard; faceDown: boolean };
  const [boardMonsters, setBoardMonsters] = useState<Array<BoardCard | null>>([null, null, null, null, null]);
  const [boardSpellTraps, setBoardSpellTraps] = useState<Array<BoardCard | null>>([null, null, null, null, null]);
  const [boardField, setBoardField] = useState<BoardCard | null>(null);
  /** Si actif, la prochaine carte posée le sera face verso. Reset après pose. */
  const [nextFaceDown, setNextFaceDown] = useState(false);

  /** Renvoie 'monster' | 'spelltrap' | 'field' selon le type de la carte. */
  const zoneKindOf = (dc: DeckCard | null | undefined): 'monster' | 'spelltrap' | 'field' | null => {
    const t = (dc?.card?.type || '').toLowerCase();
    if (!t) return null;
    if (t.includes('field') || (t.includes('spell') && (dc?.card as any)?.race?.toLowerCase?.() === 'field')) return 'field';
    if (t.includes('monster')) return 'monster';
    if (t.includes('spell') || t.includes('trap')) return 'spelltrap';
    return null;
  };

  const shuffleArr = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /** Explose chaque DeckCard en `quantity` instances (le shuffle a besoin d'unites atomiques). */
  const expandDeck = (cards: DeckCard[]): DeckCard[] =>
    cards.flatMap((dc) => Array.from({ length: dc.quantity }, () => ({ ...dc, quantity: 1 })));

  const clearBoard = () => {
    setBoardMonsters([null, null, null, null, null]);
    setBoardSpellTraps([null, null, null, null, null]);
    setBoardField(null);
    setSelectedHandIdx(null);
    setNextFaceDown(false);
  };

  const startHand = (mode: 'first' | 'second') => {
    const expanded = expandDeck(deck?.main_deck || []);
    if (expanded.length === 0) {
      toast.error('Le deck principal est vide');
      return;
    }
    const shuffled = shuffleArr(expanded);
    const size = mode === 'first' ? 5 : 6;
    setHandCards(shuffled.slice(0, size));
    setDeckPile(shuffled.slice(size));
    setGraveyard([]);
    setBanished([]);
    clearBoard();
    setPlayMode(mode);
  };

  /**
   * Pose la carte selectionnee de la main sur la zone donnee.
   * `kind` = type attendu par la zone. Si incompatible, warning + refuse.
   */
  const placeOnBoard = (kind: 'monster' | 'spelltrap' | 'field', slotIdx: number) => {
    if (selectedHandIdx === null) return;
    const dc = handCards[selectedHandIdx];
    if (!dc) return;
    const cardKind = zoneKindOf(dc);
    if (cardKind !== kind) {
      toast.error(
        `« ${dc.card?.name} » ne peut pas aller ici (attendu : ${
          kind === 'monster' ? 'monstre' : kind === 'spelltrap' ? 'magie/piège' : 'terrain'
        }).`
      );
      return;
    }
    const posed: BoardCard = { card: dc, faceDown: nextFaceDown };
    if (kind === 'monster') {
      if (boardMonsters[slotIdx]) {
        toast.error('Zone occupée — clique la carte pour la retourner, ou × pour l\'envoyer au cimetière.');
        return;
      }
      const next = [...boardMonsters];
      next[slotIdx] = posed;
      setBoardMonsters(next);
    } else if (kind === 'spelltrap') {
      if (boardSpellTraps[slotIdx]) {
        toast.error('Zone occupée — clique la carte pour la retourner, ou × pour l\'envoyer au cimetière.');
        return;
      }
      const next = [...boardSpellTraps];
      next[slotIdx] = posed;
      setBoardSpellTraps(next);
    } else {
      if (boardField) {
        // Nouveau terrain détruit l'ancien (règle YGO)
        setGraveyard((g) => [...g, boardField.card]);
      }
      setBoardField(posed);
    }
    setHandCards((h) => h.filter((_, i) => i !== selectedHandIdx));
    setSelectedHandIdx(null);
    setNextFaceDown(false); // reset après pose
  };

  /** Retourne la carte posée dans une zone (face visible ↔ face verso). */
  const flipZone = (kind: 'monster' | 'spelltrap' | 'field', slotIdx: number) => {
    if (kind === 'monster') {
      const c = boardMonsters[slotIdx];
      if (!c) return;
      const next = [...boardMonsters];
      next[slotIdx] = { ...c, faceDown: !c.faceDown };
      setBoardMonsters(next);
    } else if (kind === 'spelltrap') {
      const c = boardSpellTraps[slotIdx];
      if (!c) return;
      const next = [...boardSpellTraps];
      next[slotIdx] = { ...c, faceDown: !c.faceDown };
      setBoardSpellTraps(next);
    } else if (boardField) {
      setBoardField({ ...boardField, faceDown: !boardField.faceDown });
    }
  };

  /** Envoie la carte de la zone au cimetière et libère la zone. */
  const clearZone = (kind: 'monster' | 'spelltrap' | 'field', slotIdx: number) => {
    if (kind === 'monster') {
      const c = boardMonsters[slotIdx];
      if (!c) return;
      setGraveyard((g) => [...g, c.card]);
      const next = [...boardMonsters];
      next[slotIdx] = null;
      setBoardMonsters(next);
    } else if (kind === 'spelltrap') {
      const c = boardSpellTraps[slotIdx];
      if (!c) return;
      setGraveyard((g) => [...g, c.card]);
      const next = [...boardSpellTraps];
      next[slotIdx] = null;
      setBoardSpellTraps(next);
    } else {
      if (!boardField) return;
      setGraveyard((g) => [...g, boardField.card]);
      setBoardField(null);
    }
  };

  const drawOne = () => {
    if (deckPile.length === 0) {
      toast('Deck vide — deck out !', { icon: '💀' });
      return;
    }
    setHandCards((h) => [...h, deckPile[0]]);
    setDeckPile((d) => d.slice(1));
  };

  const sendToGraveyard = (fromIndex: number) => {
    const c = handCards[fromIndex];
    if (!c) return;
    setGraveyard((g) => [...g, c]);
    setHandCards((h) => h.filter((_, i) => i !== fromIndex));
  };

  const banishFromHand = (fromIndex: number) => {
    const c = handCards[fromIndex];
    if (!c) return;
    setBanished((b) => [...b, c]);
    setHandCards((h) => h.filter((_, i) => i !== fromIndex));
  };

  const resetHand = () => {
    setPlayMode(null);
    setHandCards([]);
    setDeckPile([]);
    setGraveyard([]);
    setBanished([]);
    clearBoard();
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('vue') === 'liste') setView('list');
  }, []);

  useEffect(() => {
    if (deckId) {
      fetchDeck();
      fetchComments();
    }
  }, [deckId]);

  const fetchDeck = async () => {
    try {
      const response = await api.get(`/decks/${deckId}`);
      setDeck(response.data.deck);
      setStats(response.data.stats || null);
    } catch (error) {
      console.error(error);
      toast.error('Impossible de charger le deck');
      navigate('/decks');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await api.get(`/comments/deck/${deckId}`);
      setComments(response.data.comments || response.data || []);
    } catch (error) {
      console.error(error);
      setComments([]);
    }
  };

  const handleReaction = async () => {
    try {
      if (deck?.user_reaction === 'like') {
        await api.delete(`/reactions/decks/${deckId}`);
        setDeck((p) => (p ? { ...p, user_reaction: null, likes_count: Math.max(0, (p.likes_count || 0) - 1) } : null));
      } else {
        await api.post(`/reactions/decks/${deckId}/like`);
        setDeck((p) => (p ? { ...p, user_reaction: 'like', likes_count: (p.likes_count || 0) + 1 } : null));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) {
      toast.error('Écris quelque chose');
      return;
    }
    try {
      await api.post(`/comments/deck/${deckId}`, { content: commentText });
      toast.success('Commentaire ajouté');
      setCommentText('');
      fetchComments();
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddReply = async (commentId: number) => {
    if (!replyText.trim()) return;
    try {
      await api.post(`/comments/${commentId}/reply`, {
        content: replyText,
        parent_comment_id: commentId,
      });
      setReplyText('');
      setReplyingTo(null);
      fetchComments();
    } catch (error) {
      console.error(error);
    }
  };

  const handleCopyToWishlist = async () => {
    try {
      await api.post(`/social/wishlist/${deckId}`);
      toast.success('Deck ajouté à la wishlist');
      setDeck((p) => (p ? { ...p, is_wishlisted: true } : null));
    } catch (error) {
      console.error(error);
    }
  };

  const handleShare = async () => {
    try {
      const response = await api.post(`/decks/${deckId}/share`);
      const url = `${window.location.origin}/deck/share/${response.data.share_token}`;
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié dans le presse-papiers');
    } catch (error) {
      console.error(error);
      toast.error('Impossible de générer le lien');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
        <div
          className="animate-spin"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '3px solid rgba(245,197,24,.3)',
            borderTopColor: 'var(--gold)',
          }}
        />
      </div>
    );
  }
  if (!deck) return null;

  const mainCount = deck.main_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
  const extraCount = deck.extra_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
  const sideCount = 0;
  const isLiked = deck.user_reaction === 'like';
  const isOwner = user?.id === deck.user_id;

  const deckMeta = [
    { label: 'Archétype', value: (deck as any).archetype || '— À venir' },
    { label: 'Format', value: 'TCG Advanced' },
    {
      label: 'Copié',
      value: stats && stats.copies_count > 0 ? `${stats.copies_count} fois` : '— À venir',
    },
    {
      label: 'Valeur du deck',
      value: stats
        ? stats.total_value_eur.toLocaleString('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 0,
          })
        : '— À venir',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: 'var(--bg)' }}>
      <AppBackground />
      <CornerOrnaments />
      <AppNavbar />

      {view === 'arena' ? (
        <div
          style={{
            position: 'relative',
            zIndex: 20,
            padding: '38px 40px 60px',
            maxWidth: 1440,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 380px',
            gap: 32,
            alignItems: 'start',
          }}
          className="max-lg:!grid-cols-1">
          <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontStyle: 'italic',
                    fontSize: 11,
                    letterSpacing: '0.3em',
                    color: 'var(--gold)',
                    textTransform: 'uppercase',
                  }}>
                  — Arène · variante A —
                </div>
                <h1
                  style={{
                    margin: '8px 0 0',
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 40,
                    fontWeight: 900,
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                    color: 'var(--text)',
                    lineHeight: 1,
                  }}>
                  {deck.name}
                </h1>
                <div style={{ marginTop: 8, fontSize: 15, color: 'var(--text-muted)' }}>
                  par{' '}
                  <Link
                    to={`/user/${deck.user_id}`}
                    style={{ color: 'var(--violet)', textDecoration: 'none' }}>
                    @{deck.user?.username}
                  </Link>{' '}
                  ·{' '}
                  <span style={{ fontFamily: "'Orbitron', sans-serif", fontVariantNumeric: 'tabular-nums', color: 'var(--gold)' }}>
                    {mainCount} · {extraCount} · {sideCount}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setView('list')}
                style={{
                  height: 44,
                  padding: '0 20px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elev)',
                  color: 'var(--text-muted)',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  clipPath: CUT_SM,
                }}>
                Vue grimoire →
              </button>
            </div>

            {/* Plateau 3D */}
            <div
              style={{
                marginTop: 26,
                position: 'relative',
                padding: '44px 40px 34px',
                background: 'linear-gradient(180deg,var(--bg-elev),var(--bg))',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                clipPath: CUT_ARENA,
              }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(ellipse 60% 50% at 50% 100%,rgba(168,85,247,.2),transparent 70%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage:
                    'linear-gradient(rgba(245,197,24,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(245,197,24,.055) 1px,transparent 1px)',
                  backgroundSize: '34px 34px',
                }}
              />
              {playMode === null ? (
                /* Etat initial : CTA test hand */
                <div
                  style={{
                    position: 'relative',
                    padding: '30px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 20,
                  }}>
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontStyle: 'italic',
                      fontSize: 13,
                      letterSpacing: '0.3em',
                      color: 'var(--gold)',
                      textTransform: 'uppercase',
                    }}>
                    — Test hand solo —
                  </div>
                  <h2
                    style={{
                      margin: 0,
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 24,
                      fontWeight: 900,
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                      color: 'var(--text)',
                      textAlign: 'center',
                    }}>
                    Piocher pour tester ton ouverture
                  </h2>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 460 }}>
                    Simule une main d'ouverture pour évaluer la variance de ton deck. P1 pioche 5 cartes,
                    P2 pioche 6 (5 + draw du tour 1).
                  </p>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      onClick={() => startHand('first')}
                      style={{
                        height: 52,
                        padding: '0 26px',
                        position: 'relative',
                        isolation: 'isolate',
                        border: 0,
                        background: 'transparent',
                        color: 'var(--bg)',
                        fontFamily: "'Orbitron', sans-serif",
                        fontWeight: 700,
                        fontSize: 12,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}>
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'var(--violet)',
                          transform: 'translate(5px,0)',
                          clipPath: CUT_BTN,
                          zIndex: -1,
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'var(--gold)',
                          clipPath: CUT_BTN,
                          zIndex: -1,
                        }}
                      />
                      Jouer en 1er · 5 cartes
                    </button>
                    <button
                      onClick={() => startHand('second')}
                      style={{
                        height: 52,
                        padding: '0 26px',
                        border: '1px solid var(--violet)',
                        background: 'rgba(168,85,247,.12)',
                        color: 'var(--violet)',
                        fontFamily: "'Orbitron', sans-serif",
                        fontWeight: 700,
                        fontSize: 12,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        clipPath: CUT_SM,
                      }}>
                      Jouer en 2nd · 6 cartes
                    </button>
                  </div>
                </div>
              ) : (
                /* Mode test hand actif : main + compteurs + controles */
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Barre du haut : mode + compteurs + reset */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 12,
                      justifyContent: 'space-between',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          padding: '6px 14px',
                          background: playMode === 'first' ? 'var(--gold)' : 'var(--violet)',
                          color: 'var(--bg)',
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          clipPath: CUT_SM,
                        }}>
                        {playMode === 'first' ? 'Joueur 1' : 'Joueur 2'}
                      </span>
                      <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, color: 'var(--text-muted)' }}>
                        Main <strong style={{ color: 'var(--text)' }}>{handCards.length}</strong> · Deck{' '}
                        <strong style={{ color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{deckPile.length}</strong> ·{' '}
                        Cimetière <strong style={{ color: 'var(--magenta)' }}>{graveyard.length}</strong>
                        {banished.length > 0 && (
                          <>
                            {' '}· Bannies <strong style={{ color: 'var(--cyan)' }}>{banished.length}</strong>
                          </>
                        )}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={drawOne}
                        disabled={deckPile.length === 0}
                        style={{
                          height: 38,
                          padding: '0 16px',
                          border: '1px solid var(--gold)',
                          background: deckPile.length ? 'linear-gradient(135deg,var(--gold),var(--gold-dim))' : 'var(--panel)',
                          color: deckPile.length ? 'var(--bg)' : 'var(--text-dim)',
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          cursor: deckPile.length ? 'pointer' : 'not-allowed',
                          clipPath: CUT_SM,
                        }}>
                        Piocher +1
                      </button>
                      <button
                        onClick={() => startHand(playMode)}
                        style={{
                          height: 38,
                          padding: '0 16px',
                          border: '1px solid var(--violet)',
                          background: 'transparent',
                          color: 'var(--violet)',
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          clipPath: CUT_SM,
                        }}>
                        Repiocher
                      </button>
                      <button
                        onClick={resetHand}
                        style={{
                          height: 38,
                          padding: '0 16px',
                          border: '1px solid var(--border)',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          clipPath: CUT_SM,
                        }}>
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Plateau 3D interactif — zones cliquables selon la carte selectionnee */}
                  {(() => {
                    const selectedDc = selectedHandIdx !== null ? handCards[selectedHandIdx] : null;
                    const selectedKind = zoneKindOf(selectedDc);

                    /** Rendu d'une zone du plateau (avec carte posée ou vide, clic contextuel). */
                    const renderZone = (
                      kind: 'monster' | 'spelltrap' | 'field',
                      slotIdx: number,
                      occupied: BoardCard | null,
                      accent: string,
                      label: string,
                      w = 82,
                      h = 112
                    ) => {
                      const isDropTarget = selectedKind === kind && !occupied;
                      return (
                        <div
                          key={`${kind}-${slotIdx}`}
                          onClick={() => {
                            if (occupied) flipZone(kind, slotIdx);
                            else if (selectedHandIdx !== null) placeOnBoard(kind, slotIdx);
                          }}
                          title={
                            occupied
                              ? `${occupied.card.card?.name} · ${occupied.faceDown ? 'face verso' : 'face visible'} — clic pour retourner, × pour cimetière`
                              : selectedHandIdx !== null
                              ? isDropTarget
                                ? `Cliquer pour poser${nextFaceDown ? ' face verso' : ''}`
                                : `Zone ${label.toLowerCase()} — incompatible avec la carte sélectionnée`
                              : label
                          }
                          style={{
                            width: w,
                            height: h,
                            flex: 'none',
                            display: 'grid',
                            placeItems: 'center',
                            textAlign: 'center',
                            overflow: 'hidden',
                            cursor:
                              occupied || (selectedHandIdx !== null && isDropTarget)
                                ? 'pointer'
                                : 'default',
                            background: occupied
                              ? 'linear-gradient(150deg,var(--border-soft),var(--bg-elev))'
                              : isDropTarget
                              ? `${accent.replace(/,\s*\.[0-9]+\)/, ',.15)')}`
                              : 'rgba(255,255,255,.02)',
                            border: occupied
                              ? `1px solid ${accent}`
                              : isDropTarget
                              ? `1px solid ${accent}`
                              : `1px dashed ${accent.replace(/,\s*\.[0-9]+\)/, ',.4)')}`,
                            boxShadow: occupied
                              ? `0 0 20px -4px ${accent}`
                              : isDropTarget
                              ? `0 0 22px -2px ${accent}, inset 0 0 12px ${accent}`
                              : undefined,
                            transition: 'all 180ms cubic-bezier(.2,.8,.2,1)',
                            position: 'relative',
                          }}>
                          {occupied ? (
                            occupied.faceDown ? (
                              /* Dos de carte : dégradé cyan-violet + logo Y central façon YGO */
                              <div
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  background:
                                    'radial-gradient(circle at 50% 40%,var(--border-soft) 0%,var(--border-soft) 60%,var(--bg-elev) 100%)',
                                  display: 'grid',
                                  placeItems: 'center',
                                  position: 'relative',
                                  overflow: 'hidden',
                                }}>
                                <div
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundImage:
                                      'repeating-linear-gradient(45deg,rgba(245,197,24,.06) 0 6px,transparent 6px 12px)',
                                  }}
                                />
                                <div
                                  style={{
                                    width: '58%',
                                    aspectRatio: '1',
                                    borderRadius: '50%',
                                    background:
                                      'radial-gradient(circle,var(--gold) 0%,var(--gold-dim) 55%,rgba(194,154,15,0) 75%)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontFamily: "'Cormorant Garamond', serif",
                                    fontStyle: 'italic',
                                    fontSize: h * 0.28,
                                    fontWeight: 700,
                                    color: 'var(--bg)',
                                    textShadow: '0 1px 2px rgba(0,0,0,.4)',
                                    position: 'relative',
                                  }}>
                                  K
                                </div>
                              </div>
                            ) : occupied.card.card?.card_images?.[0]?.image_url_small ? (
                              <img
                                src={occupied.card.card.card_images[0].image_url_small}
                                alt={occupied.card.card.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <span style={{ fontSize: 9, color: 'var(--text)', padding: 4 }}>
                                {occupied.card.card?.name}
                              </span>
                            )
                          ) : (
                            <span
                              style={{
                                fontFamily: "'Orbitron', sans-serif",
                                fontSize: 9,
                                letterSpacing: '0.12em',
                                color: isDropTarget ? 'var(--text)' : 'var(--text-muted)',
                                opacity: isDropTarget ? 0.9 : 0.6,
                                textTransform: 'uppercase',
                              }}>
                              {label}
                            </span>
                          )}
                          {/* × pour envoyer au cimetière depuis la zone posée */}
                          {occupied && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                clearZone(kind, slotIdx);
                              }}
                              title="Envoyer au cimetière"
                              style={{
                                position: 'absolute',
                                top: 2,
                                right: 2,
                                width: 16,
                                height: 16,
                                border: '1px solid rgba(255,46,136,.5)',
                                background: 'rgba(11,9,6,.85)',
                                color: 'var(--magenta)',
                                fontFamily: "'Orbitron', sans-serif",
                                fontSize: 10,
                                fontWeight: 700,
                                lineHeight: 1,
                                display: 'grid',
                                placeItems: 'center',
                                cursor: 'pointer',
                                padding: 0,
                              }}>
                              ×
                            </button>
                          )}
                        </div>
                      );
                    };

                    return (
                      <div
                        style={{
                          position: 'relative',
                          transform: 'perspective(1100px) rotateX(17deg)',
                          transformOrigin: '50% 100%',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 14,
                          alignItems: 'center',
                        }}>
                        {/* Rangée du haut : 5 zones monstres */}
                        <div style={{ display: 'flex', gap: 14 }}>
                          {boardMonsters.map((occ, i) =>
                            renderZone('monster', i, occ, 'rgba(245,197,24,.55)', 'Monstre')
                          )}
                        </div>
                        {/* Rangée du bas : 5 zones magies/pièges */}
                        <div style={{ display: 'flex', gap: 14 }}>
                          {boardSpellTraps.map((occ, i) =>
                            renderZone('spelltrap', i, occ, 'rgba(168,85,247,.55)', 'M/P')
                          )}
                        </div>
                        {/* Ligne info : EXTRA / TERRAIN / CIMETIÈRE */}
                        <div
                          style={{
                            width: '100%',
                            maxWidth: 640,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: 6,
                          }}>
                          <div
                            style={{
                              width: 76,
                              height: 46,
                              border: '1px dashed rgba(34,211,238,.5)',
                              display: 'grid',
                              placeItems: 'center',
                              fontFamily: "'Orbitron', sans-serif",
                              fontSize: 9,
                              color: 'var(--cyan)',
                              letterSpacing: '0.1em',
                            }}
                            title={`Extra deck : ${extraCount} cartes (non cliquable en test hand)`}>
                            EXTRA {extraCount}
                          </div>
                          {renderZone('field', 0, boardField, 'rgba(245,197,24,.55)', 'Terrain', 104, 44)}
                          <div
                            style={{
                              width: 76,
                              height: 46,
                              border: '1px dashed rgba(255,46,136,.45)',
                              display: 'grid',
                              placeItems: 'center',
                              fontFamily: "'Orbitron', sans-serif",
                              fontSize: 9,
                              color: 'var(--magenta)',
                              letterSpacing: '0.1em',
                            }}
                            title={`Cimetière : ${graveyard.length} cartes`}>
                            CIMETIÈRE {graveyard.length}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Instruction + toggle face verso */}
                  {selectedHandIdx !== null && (
                    <div
                      style={{
                        padding: '8px 14px',
                        background: 'rgba(245,197,24,.08)',
                        border: '1px solid rgba(245,197,24,.3)',
                        color: 'var(--gold)',
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: 10,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 14,
                        flexWrap: 'wrap',
                      }}>
                      <span>
                        « {handCards[selectedHandIdx]?.card?.name} » sélectionnée — clique une zone
                      </span>
                      <button
                        onClick={() => setNextFaceDown((v) => !v)}
                        title={nextFaceDown ? 'La carte sera posée face verso' : 'La carte sera posée face visible'}
                        style={{
                          padding: '4px 12px',
                          border: `1px solid ${nextFaceDown ? 'var(--gold)' : 'var(--border)'}`,
                          background: nextFaceDown ? 'rgba(245,197,24,.15)' : 'transparent',
                          color: nextFaceDown ? 'var(--gold)' : 'var(--text-muted)',
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 9,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}>
                        {nextFaceDown ? '✓ Face verso (set)' : 'Face verso (set)'}
                      </button>
                    </div>
                  )}

                  {/* Main tiree — flex-wrap largeur fixe : les cartes ne
                      grossissent PAS quand la main se vide. */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 12,
                      padding: '10px 0',
                    }}>
                    {handCards.map((dc, i) => {
                      const isSelected = selectedHandIdx === i;
                      const kind = zoneKindOf(dc);
                      const accent =
                        kind === 'monster' ? 'var(--gold)' : kind === 'field' ? 'var(--cyan)' : kind === 'spelltrap' ? 'var(--violet)' : 'var(--border)';
                      return (
                        <div key={`${dc.card_id}-${i}`} style={{ position: 'relative', width: 130, flex: 'none' }}>
                          <div
                            onClick={() => setSelectedHandIdx(isSelected ? null : i)}
                            style={{
                              aspectRatio: '59 / 86',
                              background: 'linear-gradient(135deg,var(--panel-2),var(--bg-elev))',
                              border: `${isSelected ? 2 : 1}px solid ${isSelected ? accent : 'var(--border)'}`,
                              overflow: 'hidden',
                              cursor: 'pointer',
                              transform: isSelected ? 'translateY(-8px)' : 'translateY(0)',
                              boxShadow: isSelected
                                ? `0 12px 28px rgba(0,0,0,.6),0 0 26px ${accent.replace(')', ',.5)').replace('#', 'rgba(')}`
                                : '0 6px 16px rgba(0,0,0,.45)',
                              transition: 'all 200ms cubic-bezier(.2,.8,.2,1)',
                              clipPath: 'polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)',
                            }}>
                            {dc.card?.card_images?.[0]?.image_url_small ? (
                              <img
                                src={dc.card.card_images[0].image_url_small}
                                alt={dc.card.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
                                {dc.card?.name}
                              </div>
                            )}
                          </div>
                          <div style={{ marginTop: 6, display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); sendToGraveyard(i); }}
                              title="Envoyer au cimetière"
                              style={{
                                flex: 1,
                                padding: '4px 0',
                                border: '1px solid rgba(255,46,136,.5)',
                                background: 'transparent',
                                color: 'var(--magenta)',
                                fontFamily: "'Orbitron', sans-serif",
                                fontSize: 8,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                              }}>
                              Cim.
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); banishFromHand(i); }}
                              title="Bannir"
                              style={{
                                flex: 1,
                                padding: '4px 0',
                                border: '1px solid rgba(34,211,238,.5)',
                                background: 'transparent',
                                color: 'var(--cyan)',
                                fontFamily: "'Orbitron', sans-serif",
                                fontSize: 8,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                              }}>
                              Bann.
                            </button>
                          </div>
                          <div
                            style={{
                              marginTop: 5,
                              fontFamily: "'Orbitron', sans-serif",
                              fontSize: 9,
                              color: isSelected ? accent : 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              textAlign: 'center',
                            }}
                            title={dc.card?.name}>
                            {dc.card?.name}
                          </div>
                        </div>
                      );
                    })}
                    {handCards.length === 0 && (
                      <div
                        style={{
                          width: '100%',
                          padding: 30,
                          textAlign: 'center',
                          color: 'var(--text-muted)',
                          fontFamily: "'Rajdhani',sans-serif",
                          fontSize: 14,
                        }}>
                        Main vide. Clique « Piocher +1 » pour continuer.
                      </div>
                    )}
                  </div>

                  {/* Cimetière compact — dernières cartes envoyées */}
                  {graveyard.length > 0 && (
                    <div
                      style={{
                        padding: 12,
                        background: 'rgba(255,46,136,.06)',
                        border: '1px solid rgba(255,46,136,.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flexWrap: 'wrap',
                      }}>
                      <span
                        style={{
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 10,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: 'var(--magenta)',
                        }}>
                        Cimetière ({graveyard.length})
                      </span>
                      {graveyard.slice(-6).map((dc, i) => (
                        <span
                          key={`gy-${i}`}
                          style={{
                            padding: '3px 8px',
                            background: 'rgba(11,9,6,.7)',
                            border: '1px solid rgba(255,46,136,.3)',
                            color: 'var(--text-muted)',
                            fontSize: 11,
                          }}>
                          {dc.card?.name}
                        </span>
                      ))}
                      {graveyard.length > 6 && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>… +{graveyard.length - 6}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cartes clés */}
            <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 12,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--gold)',
                }}>
                Cartes clés
              </span>
              <span
                style={{
                  flex: 1,
                  height: 1,
                  background: 'linear-gradient(90deg,var(--border),transparent)',
                }}
              />
            </div>
            <div
              style={{
                marginTop: 18,
                display: 'grid',
                gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                gap: 20,
              }}
              className="max-lg:!grid-cols-4 max-sm:!grid-cols-3">
              {(deck.main_deck || []).slice(0, 6).map((dc, i) => (
                <CardTile
                  key={dc.id}
                  uri={dc.card?.card_images?.[0]?.image_url_small}
                  name={dc.card?.name}
                  quantity={dc.quantity}
                  index={i}
                />
              ))}
            </div>
          </div>

          {/* Sidebar sticky */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 84 }} className="max-lg:!static">
            <div
              style={{
                padding: 22,
                background: 'linear-gradient(150deg,var(--panel),var(--bg-sunken))',
                border: '1px solid var(--border)',
                clipPath: CUT_PANEL,
              }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleReaction}
                  style={{
                    height: 44,
                    padding: '0 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    border: `1px solid ${isLiked ? 'var(--magenta)' : 'var(--border)'}`,
                    background: isLiked ? 'rgba(255,46,136,.16)' : 'var(--bg-elev)',
                    color: isLiked ? 'var(--magenta)' : 'var(--text-muted)',
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    fontVariantNumeric: 'tabular-nums',
                    cursor: 'pointer',
                    clipPath: CUT_SM,
                  }}>
                  ♥ {deck.likes_count || 0}
                </button>
                <button
                  onClick={handleShare}
                  style={{
                    flex: 1,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elev)',
                    color: 'var(--text-muted)',
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}>
                  Partager
                </button>
              </div>
              {isOwner ? (
                <button
                  onClick={() => navigate(`/decks/${deckId}/edit`)}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    height: 50,
                    position: 'relative',
                    isolation: 'isolate',
                    border: 0,
                    background: 'transparent',
                    color: 'var(--bg)',
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}>
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'var(--violet)',
                      transform: 'translate(5px,0)',
                      clipPath: CUT_BTN,
                      zIndex: -1,
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'var(--gold)',
                      clipPath: CUT_BTN,
                      zIndex: -1,
                    }}
                  />
                  Modifier le deck
                </button>
              ) : (
                <button
                  onClick={handleCopyToWishlist}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    height: 50,
                    position: 'relative',
                    isolation: 'isolate',
                    border: 0,
                    background: 'transparent',
                    color: 'var(--bg)',
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}>
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'var(--violet)',
                      transform: 'translate(5px,0)',
                      clipPath: CUT_BTN,
                      zIndex: -1,
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'var(--gold)',
                      clipPath: CUT_BTN,
                      zIndex: -1,
                    }}
                  />
                  Copier dans mes decks
                </button>
              )}

              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {deckMeta.map((m) => (
                  <div
                    key={m.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 14,
                      color: 'var(--text-muted)',
                      paddingBottom: 8,
                      borderBottom: '1px solid rgba(58,46,28,.6)',
                    }}>
                    <span>{m.label}</span>
                    <span
                      style={{
                        color: 'var(--text)',
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: 12,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div
              style={{
                padding: 22,
                background: 'linear-gradient(150deg,var(--panel),var(--bg-sunken))',
                border: '1px solid var(--border)',
                clipPath: CUT_PANEL,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 11,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'var(--gold)',
                  }}>
                  Commentaires {comments.length}
                </span>
                <span
                  style={{
                    flex: 1,
                    height: 1,
                    background: 'linear-gradient(90deg,var(--border),transparent)',
                  }}
                />
              </div>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {comments.slice(0, 5).map((c) => (
                  <div key={c.id} style={{ display: 'flex', gap: 11 }}>
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        flex: 'none',
                        background: 'linear-gradient(135deg,var(--violet),var(--gold-dim))',
                        color: 'var(--bg)',
                        display: 'grid',
                        placeItems: 'center',
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: 10,
                        fontWeight: 900,
                        clipPath: 'polygon(50% 0,100% 27%,100% 73%,50% 100%,0 73%,0 27%)',
                      }}>
                      {c.user?.username?.slice(0, 2).toUpperCase()}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <span
                          style={{
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: 10,
                            letterSpacing: '0.08em',
                            color: 'var(--violet-soft)',
                          }}>
                          @{c.user?.username}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          {new Date(c.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                        {c.content}
                      </p>
                      <div style={{ marginTop: 6 }}>
                        <button
                          onClick={() => setReplyingTo(c.id === replyingTo ? null : c.id)}
                          style={{
                            background: 'transparent',
                            border: 0,
                            color: 'var(--violet)',
                            fontSize: 11,
                            cursor: 'pointer',
                            padding: 0,
                          }}>
                          Répondre
                        </button>
                      </div>
                      {replyingTo === c.id && (
                        <div style={{ marginTop: 8 }}>
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            style={{
                              width: '100%',
                              padding: 8,
                              background: 'var(--bg-elev)',
                              border: '1px solid var(--border)',
                              color: 'var(--text)',
                              fontFamily: "'Rajdhani', sans-serif",
                              fontSize: 13,
                              minHeight: 60,
                              resize: 'vertical',
                              outline: 'none',
                            }}
                          />
                          <button
                            onClick={() => handleAddReply(c.id)}
                            style={{
                              marginTop: 6,
                              padding: '6px 12px',
                              background: 'var(--violet)',
                              color: '#fff',
                              border: 0,
                              fontFamily: "'Orbitron', sans-serif",
                              fontSize: 10,
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              cursor: 'pointer',
                              clipPath: CUT_SM,
                            }}>
                            Envoyer
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center' }}>
                    Aucune offrande encore. Sois le premier.
                  </p>
                )}
              </div>
              <form onSubmit={handleAddComment}>
                <input
                  placeholder="Laisser une offrande…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  style={{
                    marginTop: 16,
                    width: '100%',
                    padding: '12px 14px',
                    background: 'var(--bg-elev)',
                    border: '1px solid var(--border)',
                    borderLeft: '2px solid var(--violet)',
                    color: 'var(--text)',
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </form>
            </div>
          </div>
        </div>
      ) : (
        // Vue LIST (grimoire)
        <div
          style={{
            position: 'relative',
            zIndex: 20,
            padding: '38px 40px 60px',
            maxWidth: 1440,
            margin: '0 auto',
          }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: 'italic',
                  fontSize: 11,
                  letterSpacing: '0.3em',
                  color: 'var(--gold)',
                  textTransform: 'uppercase',
                }}>
                — Grimoire · variante B —
              </div>
              <h1
                style={{
                  margin: '8px 0 0',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 40,
                  fontWeight: 900,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                  color: 'var(--text)',
                  lineHeight: 1,
                }}>
                {deck.name}
              </h1>
              <div style={{ marginTop: 8, fontSize: 15, color: 'var(--text-muted)' }}>
                par{' '}
                <Link to={`/user/${deck.user_id}`} style={{ color: 'var(--violet)', textDecoration: 'none' }}>
                  @{deck.user?.username}
                </Link>{' '}
                ·{' '}
                <span style={{ fontFamily: "'Orbitron', sans-serif", fontVariantNumeric: 'tabular-nums', color: 'var(--gold)' }}>
                  {mainCount} · {extraCount} · {sideCount}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleReaction}
                style={{
                  height: 44,
                  padding: '0 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: `1px solid ${isLiked ? 'var(--magenta)' : 'var(--border)'}`,
                  background: isLiked ? 'rgba(255,46,136,.16)' : 'var(--bg-elev)',
                  color: isLiked ? 'var(--magenta)' : 'var(--text-muted)',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  clipPath: CUT_SM,
                }}>
                ♥ {deck.likes_count || 0}
              </button>
              <button
                onClick={() => setView('arena')}
                style={{
                  height: 44,
                  padding: '0 20px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elev)',
                  color: 'var(--text-muted)',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  clipPath: CUT_SM,
                }}>
                ← Vue arène
              </button>
            </div>
          </div>

          {/* Jauge répartition — À venir */}
          <div
            style={{
              marginTop: 24,
              padding: '18px 22px',
              background: 'linear-gradient(135deg,var(--panel),var(--panel-2))',
              border: '1px solid var(--border)',
              clipPath: CUT_JAUGE,
            }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 10,
                letterSpacing: '0.18em',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}>
              <span>Répartition du deck principal</span>
              <span style={{ color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{mainCount} / 40</span>
            </div>
            <div style={{ marginTop: 10, height: 10, display: 'flex', gap: 2 }}>
              <div
                style={{
                  flex: stats?.main_by_type.monster ?? 22,
                  background: 'linear-gradient(90deg,var(--gold-dim),var(--gold))',
                }}
              />
              <div
                style={{
                  flex: stats?.main_by_type.spell ?? 12,
                  background: 'linear-gradient(90deg,var(--violet),var(--violet))',
                }}
              />
              <div
                style={{
                  flex: stats?.main_by_type.trap ?? 6,
                  background: 'linear-gradient(90deg,var(--cyan),var(--cyan))',
                }}
              />
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, background: 'var(--gold)' }} />
                Monstres {stats ? stats.main_by_type.monster : '—'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, background: 'var(--violet)' }} />
                Magies {stats ? stats.main_by_type.spell : '—'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, background: 'var(--cyan)' }} />
                Pièges {stats ? stats.main_by_type.trap : '—'}
              </span>
            </div>
          </div>

          {/* 3 colonnes */}
          <div
            style={{
              marginTop: 26,
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1fr',
              gap: 26,
              alignItems: 'start',
            }}
            className="max-lg:!grid-cols-1">
            {[
              { title: 'Deck principal', count: mainCount, rows: deck.main_deck || [] },
              { title: 'Extra', count: extraCount, rows: deck.extra_deck || [] },
              { title: 'Side', count: sideCount, rows: [] as any[] },
            ].map((col) => (
              <div key={col.title}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 12,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--gold)',
                    }}>
                    {col.title}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                    {col.count}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      height: 1,
                      background: 'linear-gradient(90deg,var(--border),transparent)',
                    }}
                  />
                </div>
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {col.rows.length === 0 && (
                    <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: 13, textAlign: 'center' }}>
                      {col.title === 'Side' ? '— À venir —' : 'Aucune carte'}
                    </div>
                  )}
                  {col.rows.map((r: any) => (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 13,
                        padding: '9px 12px',
                        background: 'var(--bg-elev)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        clipPath: CUT_ROW,
                      }}>
                      <div
                        style={{
                          width: 28,
                          height: 40,
                          background: 'linear-gradient(135deg,var(--panel-2),var(--bg-elev))',
                          border: '1px solid var(--border)',
                          flex: 'none',
                          display: 'grid',
                          placeItems: 'center',
                        }}>
                        <CardIcon size={16} className="text-blue-600" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--text)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                          {r.card?.name}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-muted)' }}>
                          {r.card?.type}
                        </div>
                      </div>
                      <span
                        style={{
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--gold)',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                        ×{r.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeckView;
