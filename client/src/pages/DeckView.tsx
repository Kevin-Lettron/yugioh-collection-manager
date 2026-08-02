import { useState, useEffect, FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Deck, DeckComment } from '../../../shared/types';
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
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<DeckComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [view, setView] = useState<'arena' | 'list'>('arena');

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
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0B0906' }}>
        <div
          className="animate-spin"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '3px solid rgba(245,197,24,.3)',
            borderTopColor: '#F5C518',
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

  // Zones de l'arène : ce que ta collection contient (front card in zone) — placeholder
  const zone = (_label: string, filled: boolean, accent: string): React.CSSProperties => ({
    width: 82,
    height: 112,
    flex: 'none',
    display: 'grid',
    placeItems: 'center',
    textAlign: 'center',
    background: filled
      ? 'linear-gradient(150deg,#2A2216,#14100A)'
      : 'rgba(255,255,255,.02)',
    border: filled ? `1px solid ${accent}` : '1px dashed rgba(245,197,24,.22)',
    boxShadow: filled ? `0 0 20px -4px ${accent}` : undefined,
  });

  const arenaBack: Array<{ label: string; filled: boolean; accent: string }> = [
    { label: 'MONSTRE', filled: true, accent: 'rgba(245,197,24,.55)' },
    { label: 'MONSTRE', filled: true, accent: 'rgba(245,197,24,.55)' },
    { label: 'MONSTRE', filled: true, accent: 'rgba(245,197,24,.55)' },
    { label: '', filled: false, accent: '' },
    { label: '', filled: false, accent: '' },
  ];
  const arenaFront: Array<{ label: string; filled: boolean; accent: string }> = [
    { label: 'MAGIE', filled: true, accent: 'rgba(168,85,247,.55)' },
    { label: 'MAGIE', filled: true, accent: 'rgba(168,85,247,.55)' },
    { label: '', filled: false, accent: '' },
    { label: 'PIÈGE', filled: true, accent: 'rgba(34,211,238,.5)' },
    { label: '', filled: false, accent: '' },
  ];

  const deckMeta = [
    { label: 'Archétype', value: (deck as any).archetype || '— À venir' },
    { label: 'Format', value: 'TCG Advanced' },
    { label: 'Copié', value: '— À venir' },
    { label: 'Valeur du deck', value: '— À venir' },
  ];

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: '#0B0906' }}>
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
                    color: '#F5C518',
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
                    color: '#F5EFE0',
                    lineHeight: 1,
                  }}>
                  {deck.name}
                </h1>
                <div style={{ marginTop: 8, fontSize: 15, color: '#A99C86' }}>
                  par{' '}
                  <Link
                    to={`/user/${deck.user_id}`}
                    style={{ color: '#A855F7', textDecoration: 'none' }}>
                    @{deck.user?.username}
                  </Link>{' '}
                  ·{' '}
                  <span style={{ fontFamily: "'Orbitron', sans-serif", fontVariantNumeric: 'tabular-nums', color: '#F5C518' }}>
                    {mainCount} · {extraCount} · {sideCount}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setView('list')}
                style={{
                  height: 44,
                  padding: '0 20px',
                  border: '1px solid #3A2E1C',
                  background: '#14100A',
                  color: '#A99C86',
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
                background: 'linear-gradient(180deg,#14100A,#0B0906)',
                border: '1px solid #3A2E1C',
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
                <div style={{ display: 'flex', gap: 14 }}>
                  {arenaBack.map((z, i) => (
                    <div key={i} style={zone(z.label, z.filled, z.accent)}>
                      <span
                        style={{
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 9,
                          letterSpacing: '0.12em',
                          color: '#A99C86',
                          opacity: 0.75,
                        }}>
                        {z.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 14 }}>
                  {arenaFront.map((z, i) => (
                    <div key={i} style={zone(z.label, z.filled, z.accent)}>
                      <span
                        style={{
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 9,
                          letterSpacing: '0.12em',
                          color: '#A99C86',
                          opacity: 0.75,
                        }}>
                        {z.label}
                      </span>
                    </div>
                  ))}
                </div>
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
                      color: '#22D3EE',
                      letterSpacing: '0.1em',
                    }}>
                    EXTRA {extraCount}
                  </div>
                  <div
                    style={{
                      width: 104,
                      height: 36,
                      border: '1px solid rgba(245,197,24,.4)',
                      display: 'grid',
                      placeItems: 'center',
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 9,
                      color: '#C29A0F',
                      letterSpacing: '0.12em',
                    }}>
                    TERRAIN
                  </div>
                  <div
                    style={{
                      width: 76,
                      height: 46,
                      border: '1px dashed rgba(255,46,136,.45)',
                      display: 'grid',
                      placeItems: 'center',
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 9,
                      color: '#FF2E88',
                      letterSpacing: '0.1em',
                    }}>
                    CIMETIÈRE
                  </div>
                </div>
              </div>
            </div>

            {/* Cartes clés */}
            <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 12,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#F5C518',
                }}>
                Cartes clés
              </span>
              <span
                style={{
                  flex: 1,
                  height: 1,
                  background: 'linear-gradient(90deg,#3A2E1C,transparent)',
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
                background: 'linear-gradient(150deg,#1A1510,#0F0C07)',
                border: '1px solid #3A2E1C',
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
                    border: `1px solid ${isLiked ? '#FF2E88' : '#3A2E1C'}`,
                    background: isLiked ? 'rgba(255,46,136,.16)' : '#14100A',
                    color: isLiked ? '#FF2E88' : '#A99C86',
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
                    border: '1px solid #3A2E1C',
                    background: '#14100A',
                    color: '#A99C86',
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
                    color: '#0B0906',
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
                      background: '#A855F7',
                      transform: 'translate(5px,0)',
                      clipPath: CUT_BTN,
                      zIndex: -1,
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: '#F5C518',
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
                    color: '#0B0906',
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
                      background: '#A855F7',
                      transform: 'translate(5px,0)',
                      clipPath: CUT_BTN,
                      zIndex: -1,
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: '#F5C518',
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
                      color: '#A99C86',
                      paddingBottom: 8,
                      borderBottom: '1px solid rgba(58,46,28,.6)',
                    }}>
                    <span>{m.label}</span>
                    <span
                      style={{
                        color: '#F5EFE0',
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
                background: 'linear-gradient(150deg,#1A1510,#0F0C07)',
                border: '1px solid #3A2E1C',
                clipPath: CUT_PANEL,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 11,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: '#F5C518',
                  }}>
                  Commentaires {comments.length}
                </span>
                <span
                  style={{
                    flex: 1,
                    height: 1,
                    background: 'linear-gradient(90deg,#3A2E1C,transparent)',
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
                        background: 'linear-gradient(135deg,#A855F7,#C29A0F)',
                        color: '#0B0906',
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
                            color: '#C084FC',
                          }}>
                          @{c.user?.username}
                        </span>
                        <span style={{ fontSize: 11, color: '#6E6250' }}>
                          {new Date(c.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.5, color: '#A99C86' }}>
                        {c.content}
                      </p>
                      <div style={{ marginTop: 6 }}>
                        <button
                          onClick={() => setReplyingTo(c.id === replyingTo ? null : c.id)}
                          style={{
                            background: 'transparent',
                            border: 0,
                            color: '#A855F7',
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
                              background: '#14100A',
                              border: '1px solid #3A2E1C',
                              color: '#F5EFE0',
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
                              background: '#A855F7',
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
                  <p style={{ color: '#6E6250', fontSize: 13, textAlign: 'center' }}>
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
                    background: '#14100A',
                    border: '1px solid #3A2E1C',
                    borderLeft: '2px solid #A855F7',
                    color: '#F5EFE0',
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
                  color: '#F5C518',
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
                  color: '#F5EFE0',
                  lineHeight: 1,
                }}>
                {deck.name}
              </h1>
              <div style={{ marginTop: 8, fontSize: 15, color: '#A99C86' }}>
                par{' '}
                <Link to={`/user/${deck.user_id}`} style={{ color: '#A855F7', textDecoration: 'none' }}>
                  @{deck.user?.username}
                </Link>{' '}
                ·{' '}
                <span style={{ fontFamily: "'Orbitron', sans-serif", fontVariantNumeric: 'tabular-nums', color: '#F5C518' }}>
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
                  border: `1px solid ${isLiked ? '#FF2E88' : '#3A2E1C'}`,
                  background: isLiked ? 'rgba(255,46,136,.16)' : '#14100A',
                  color: isLiked ? '#FF2E88' : '#A99C86',
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
                  border: '1px solid #3A2E1C',
                  background: '#14100A',
                  color: '#A99C86',
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
              background: 'linear-gradient(135deg,#1A1510,#221B12)',
              border: '1px solid #3A2E1C',
              clipPath: CUT_JAUGE,
            }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 10,
                letterSpacing: '0.18em',
                color: '#A99C86',
                textTransform: 'uppercase',
              }}>
              <span>Répartition du deck principal — À venir</span>
              <span style={{ color: '#F5C518', fontVariantNumeric: 'tabular-nums' }}>{mainCount} / 40</span>
            </div>
            <div style={{ marginTop: 10, height: 10, display: 'flex', gap: 2 }}>
              <div style={{ flex: 22, background: 'linear-gradient(90deg,#C29A0F,#F5C518)' }} />
              <div style={{ flex: 12, background: 'linear-gradient(90deg,#7C3AED,#A855F7)' }} />
              <div style={{ flex: 6, background: 'linear-gradient(90deg,#0E7490,#22D3EE)' }} />
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 20, fontSize: 13, color: '#A99C86', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, background: '#F5C518' }} />
                Monstres — À venir
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, background: '#A855F7' }} />
                Magies — À venir
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, background: '#22D3EE' }} />
                Pièges — À venir
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
                      color: '#F5C518',
                    }}>
                    {col.title}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 12,
                      color: '#A99C86',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                    {col.count}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      height: 1,
                      background: 'linear-gradient(90deg,#3A2E1C,transparent)',
                    }}
                  />
                </div>
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {col.rows.length === 0 && (
                    <div style={{ padding: 20, color: '#6E6250', fontSize: 13, textAlign: 'center' }}>
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
                        background: '#14100A',
                        border: '1px solid #3A2E1C',
                        cursor: 'pointer',
                        clipPath: CUT_ROW,
                      }}>
                      <div
                        style={{
                          width: 28,
                          height: 40,
                          background: 'linear-gradient(135deg,#221B12,#14100A)',
                          border: '1px solid #3A2E1C',
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
                            color: '#F5EFE0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                          {r.card?.name}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 12, color: '#A99C86' }}>
                          {r.card?.type}
                        </div>
                      </div>
                      <span
                        style={{
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#F5C518',
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
