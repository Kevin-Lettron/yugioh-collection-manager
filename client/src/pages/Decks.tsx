import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Deck, DeckFilters } from '../../../shared/types';
import api from '../services/api';
import toast from 'react-hot-toast';
import AppNavbar from '../components/AppNavbar';
import AppBackground from '../components/decor/AppBackground';
import CornerOrnaments from '../components/decor/CornerOrnaments';
import { GlyphPyramid } from '../components/decor/Glyphs';
import { CardIcon } from '../components/decor/Icons';

interface WishlistItem {
  id: number;
  user_id: number;
  original_deck_id: number;
  created_at: string;
  deck: Deck;
}

const CUT_BTN = 'polygon(0 0,100% 0,100% 100%,95% 100%,95% 90%,85% 90%,85% 100%,8% 100%,0 70%)';
const CUT_SM = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';
const CUT_TILE = 'polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))';

/**
 * Decks — grille 4 cols de deck-cards biseautées (mockup profile lignes 495-514).
 * Preview 2 cartes rotate, nom Orbitron, count + likes rose.
 * Header kicker « Grimoires » + CTA « Fonder un deck » primary.
 * Toggle Mes decks / Wishlist en tabs biseautés.
 */
const Decks = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'mydecks' | 'wishlist'>('mydecks');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [respectBanlist, setRespectBanlist] = useState<string>('');
  const [isPublic, setIsPublic] = useState<string>('');

  useEffect(() => {
    if (activeTab === 'mydecks') fetchDecks();
    else fetchWishlist();
  }, [activeTab, respectBanlist, isPublic]);

  const fetchDecks = async () => {
    setLoading(true);
    try {
      const params: DeckFilters = {
        respect_banlist: respectBanlist === 'true' ? true : respectBanlist === 'false' ? false : undefined,
        is_public: isPublic === 'true' ? true : isPublic === 'false' ? false : undefined,
      };
      const response = await api.get('/decks', { params });
      setDecks(response.data.data || response.data);
    } catch (error) {
      console.error('Failed to fetch decks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWishlist = async () => {
    setLoading(true);
    try {
      const response = await api.get('/social/wishlist');
      setWishlist(response.data.wishlists || response.data || []);
    } catch (error) {
      console.error('Failed to fetch wishlist:', error);
      setWishlist([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDeck = async (deckId: number) => {
    if (!confirm('Supprimer ce deck ?')) return;
    try {
      await api.delete(`/decks/${deckId}`);
      toast.success('Deck supprimé');
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
    } catch (error) {
      console.error(error);
    }
  };

  const handleRemoveFromWishlist = async (deckId: number) => {
    try {
      await api.delete(`/social/wishlist/${deckId}`);
      toast.success('Retiré de la wishlist');
      setWishlist((prev) => prev.filter((i) => i.original_deck_id !== deckId));
    } catch (error) {
      console.error(error);
    }
  };

  const cardCount = (deck: Deck) => {
    const main = (deck as any).main_deck_count ?? deck.main_deck?.reduce((s, c) => s + c.quantity, 0) ?? 0;
    const extra = (deck as any).extra_deck_count ?? deck.extra_deck?.reduce((s, c) => s + c.quantity, 0) ?? 0;
    const side = (deck as any).side_deck_count ?? 0;
    return { main, extra, side };
  };

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: 'var(--bg)' }}>
      <AppBackground />
      <CornerOrnaments />
      <AppNavbar />

      <div style={{ position: 'relative', zIndex: 20, padding: '46px 40px 60px', maxWidth: 1440, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ position: 'relative', paddingBottom: 30, borderBottom: '1px solid var(--border)' }}>
          <GlyphPyramid
            style={{ position: 'absolute', right: 0, top: -16, width: 150, height: 150, color: 'var(--gold)', opacity: 0.07 }}
          />
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: 'italic',
                  fontSize: 12,
                  letterSpacing: '0.32em',
                  color: 'var(--gold)',
                  textTransform: 'uppercase',
                }}>
                — Grimoires du Sanctuaire —
              </div>
              <h1
                style={{
                  margin: '10px 0 0',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 'clamp(38px, 5vw, 54px)',
                  fontWeight: 900,
                  lineHeight: 0.96,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                  background: 'linear-gradient(180deg,var(--text) 25%,var(--gold-dim) 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  filter: 'drop-shadow(0 0 18px rgba(245,197,24,.16))',
                }}>
                Mes Decks
              </h1>
              <p style={{ margin: '10px 0 0', fontSize: 16, color: 'var(--text-muted)' }}>
                {activeTab === 'mydecks'
                  ? `${decks.length} grimoire${decks.length > 1 ? 's' : ''} en préparation`
                  : `${wishlist.length} deck${wishlist.length > 1 ? 's' : ''} en tête`}
              </p>
            </div>
            <button
              onClick={() => navigate('/decks/new')}
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
              Fonder un deck
            </button>
          </div>

          {/* Tabs Mes decks / Wishlist */}
          <div style={{ marginTop: 26, display: 'flex', gap: 8 }}>
            {[
              { id: 'mydecks' as const, label: `Mes decks (${decks.length})` },
              { id: 'wishlist' as const, label: `Wishlist (${wishlist.length})` },
            ].map((t) => {
              const on = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    height: 44,
                    padding: '0 22px',
                    border: `1px solid ${on ? 'var(--gold)' : 'var(--border)'}`,
                    background: on ? 'rgba(245,197,24,.14)' : 'transparent',
                    color: on ? 'var(--gold)' : 'var(--text-muted)',
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    cursor: 'pointer',
                    clipPath: CUT_SM,
                  }}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters (only for mydecks) */}
        {activeTab === 'mydecks' && (
          <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <select
              value={respectBanlist}
              onChange={(e) => setRespectBanlist(e.target.value)}
              style={{
                padding: '10px 14px',
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: 13,
                letterSpacing: '0.06em',
              }}>
              <option value="">Tous les decks</option>
              <option value="true">Conformes banlist</option>
              <option value="false">Hors banlist</option>
            </select>
            <select
              value={isPublic}
              onChange={(e) => setIsPublic(e.target.value)}
              style={{
                padding: '10px 14px',
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: 13,
                letterSpacing: '0.06em',
              }}>
              <option value="">Toute visibilité</option>
              <option value="true">Publics</option>
              <option value="false">Privés</option>
            </select>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div
              className="inline-block animate-spin"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: '3px solid rgba(245,197,24,.3)',
                borderTopColor: 'var(--gold)',
              }}
            />
          </div>
        ) : (
          <>
            {/* Grid 4 cols */}
            <div
              style={{
                marginTop: 30,
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 20,
              }}
              className="max-xl:!grid-cols-3 max-lg:!grid-cols-2 max-sm:!grid-cols-1">
              {(activeTab === 'mydecks' ? decks : wishlist.map((w) => w.deck)).map((deck) => {
                const c = cardCount(deck);
                const isWishlist = activeTab === 'wishlist';
                return (
                  <div
                    key={deck.id}
                    onClick={() => navigate(`/decks/${deck.id}`)}
                    style={{
                      padding: 18,
                      background: 'linear-gradient(150deg,var(--panel),var(--bg-sunken))',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'transform 240ms cubic-bezier(.2,.8,.2,1),border-color 200ms',
                      clipPath: CUT_TILE,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-6px)';
                      e.currentTarget.style.borderColor = 'var(--gold-dim)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}>
                    <div style={{ height: 78, display: 'flex', alignItems: 'center' }}>
                      <div
                        style={{
                          width: 52,
                          height: 74,
                          border: '1px solid rgba(245,197,24,.42)',
                          background: 'linear-gradient(150deg,var(--panel-2),var(--bg-elev))',
                          transform: 'rotate(-7deg)',
                          display: 'grid',
                          placeItems: 'center',
                        }}>
                        <CardIcon size={20} className="text-blue-600" />
                      </div>
                      <div
                        style={{
                          width: 52,
                          height: 74,
                          border: '1px solid rgba(168,85,247,.42)',
                          background: 'linear-gradient(150deg,var(--panel-2),var(--bg-elev))',
                          marginLeft: -18,
                          transform: 'rotate(7deg)',
                          display: 'grid',
                          placeItems: 'center',
                        }}>
                        <CardIcon size={20} style={{ color: 'var(--violet)' }} />
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 12,
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                      {deck.name}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        color: 'var(--text-muted)',
                      }}>
                      <span style={{ fontFamily: "'Orbitron', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                        {c.main} · {c.extra} · {c.side}
                      </span>
                      <span style={{ color: 'var(--magenta)' }}>♥ {deck.likes_count || 0}</span>
                    </div>
                    {isWishlist && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          color: 'var(--text-muted)',
                        }}>
                        par <span style={{ color: 'var(--violet)' }}>@{deck.user?.username}</span>
                      </div>
                    )}
                    <div
                      style={{
                        marginTop: 10,
                        display: 'flex',
                        gap: 6,
                      }}>
                      {activeTab === 'mydecks' ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/decks/${deck.id}/edit`);
                            }}
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              background: 'var(--bg-elev)',
                              border: '1px solid var(--border)',
                              color: 'var(--gold)',
                              fontFamily: "'Orbitron', sans-serif",
                              fontSize: 9,
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}>
                            Éditer
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDeck(deck.id);
                            }}
                            style={{
                              padding: '6px 10px',
                              background: 'transparent',
                              border: '1px solid var(--danger)',
                              color: 'var(--danger)',
                              fontFamily: "'Orbitron', sans-serif",
                              fontSize: 9,
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}>
                            ×
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFromWishlist(deck.id);
                          }}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            background: 'transparent',
                            border: '1px solid var(--danger)',
                            color: 'var(--danger)',
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: 9,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}>
                          Retirer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Bloc "Dresser un deck" placeholder */}
              {activeTab === 'mydecks' && decks.length > 0 && (
                <div
                  onClick={() => navigate('/decks/new')}
                  style={{
                    padding: 18,
                    border: '1px dashed var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    minHeight: 190,
                    cursor: 'pointer',
                    transition: 'border-color 200ms',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--gold-dim)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  <CardIcon size={40} style={{ color: 'var(--gold-dim)', opacity: 0.6 }} />
                  <span
                    style={{
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      textAlign: 'center',
                    }}>
                    Dresser un deck
                  </span>
                </div>
              )}
            </div>

            {activeTab === 'mydecks' && decks.length === 0 && !loading && (
              <div
                style={{
                  marginTop: 40,
                  textAlign: 'center',
                  padding: '60px 20px',
                  border: '1px dashed var(--border)',
                  color: 'var(--text-muted)',
                }}>
                <p style={{ fontSize: 16, marginBottom: 16 }}>Aucun deck pour le moment.</p>
                <button
                  onClick={() => navigate('/decks/new')}
                  style={{
                    padding: '10px 24px',
                    background: 'var(--gold)',
                    color: 'var(--bg)',
                    border: 0,
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 12,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    cursor: 'pointer',
                    clipPath: CUT_SM,
                  }}>
                  Fonder mon premier deck
                </button>
              </div>
            )}

            {activeTab === 'wishlist' && wishlist.length === 0 && !loading && (
              <div
                style={{
                  marginTop: 40,
                  textAlign: 'center',
                  padding: '60px 20px',
                  border: '1px dashed var(--border)',
                  color: 'var(--text-muted)',
                }}>
                <p style={{ fontSize: 16, marginBottom: 16 }}>Ta wishlist est vide.</p>
                <button
                  onClick={() => navigate('/social')}
                  style={{
                    padding: '10px 24px',
                    background: 'transparent',
                    border: '1px solid var(--violet)',
                    color: 'var(--violet-soft)',
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 12,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    cursor: 'pointer',
                    clipPath: CUT_SM,
                  }}>
                  Découvrir des decks
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Decks;
