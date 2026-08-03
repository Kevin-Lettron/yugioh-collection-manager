import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { Deck, User } from '../../../shared/types';
import api, { getImageUrl } from '../services/api';
import toast from 'react-hot-toast';
import AppNavbar from '../components/AppNavbar';
import AppBackground from '../components/decor/AppBackground';
import CornerOrnaments from '../components/decor/CornerOrnaments';
import { CardIcon } from '../components/decor/Icons';

const CUT_SM = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';
const CUT_FEED = 'polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,20px 100%,0 calc(100% - 20px))';

/**
 * Social — pixel-perfect `isSocial` (DesktopFrame l.427-467).
 * Header 2 cols kicker+h1 46px dégradé + 3 sort tabs biseautés Populaires/Récents/Suivis.
 * Grid 3 cols de feed cards : image header 172px avec 3 mini-cartes fan rotate + tag,
 * corps avec name Orbitron 17px, author, likes/comments/ratio.
 */
const Social = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'decks' | 'users'>('decks');
  const [sort, setSort] = useState<'populaires' | 'recents' | 'suivis'>('populaires');

  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [decksPage, setDecksPage] = useState(1);
  const [hasMoreDecks, setHasMoreDecks] = useState(true);

  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const debouncedUserSearch = useDebounce(userSearch, 500);

  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());

  const decksLoadMoreRef = useInfiniteScroll({
    loading: decksLoading,
    hasMore: hasMoreDecks,
    onLoadMore: () => setDecksPage((p) => p + 1),
  });

  useEffect(() => {
    fetchFollowing();
  }, []);

  useEffect(() => {
    if (tab === 'decks') fetchDecks(decksPage);
  }, [decksPage, tab, sort]);

  useEffect(() => {
    if (tab === 'users') searchUsers();
  }, [debouncedUserSearch, tab]);

  const fetchFollowing = async () => {
    try {
      const response = await api.get('/social/following');
      const following = response.data.following || response.data || [];
      setFollowingIds(new Set(following.map((f: any) => f.following_id || f.id)));
    } catch (error) {
      console.error(error);
    }
  };

  const fetchDecks = async (page: number) => {
    setDecksLoading(true);
    try {
      const response = await api.get('/decks/public', { params: { page, limit: 12 } });
      const { data, total_pages } = response.data;
      let filtered = data.filter((d: Deck) => d.user_id !== user?.id);
      // simple client-side sort
      if (sort === 'populaires') {
        filtered = [...filtered].sort((a: Deck, b: Deck) => (b.likes_count || 0) - (a.likes_count || 0));
      } else if (sort === 'recents') {
        filtered = [...filtered].sort(
          (a: Deck, b: Deck) =>
            new Date(b.created_at as any).getTime() - new Date(a.created_at as any).getTime()
        );
      } else if (sort === 'suivis') {
        filtered = filtered.filter((d: Deck) => followingIds.has(d.user_id));
      }
      if (page === 1) setDecks(filtered);
      else setDecks((prev) => [...prev, ...filtered]);
      setHasMoreDecks(page < total_pages);
    } catch (error) {
      console.error(error);
    } finally {
      setDecksLoading(false);
    }
  };

  const searchUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await api.get('/auth/users/search', {
        params: { q: debouncedUserSearch || undefined },
      });
      setUsers(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleFollow = async (userId: number) => {
    try {
      await api.post(`/social/follow/${userId}`);
      setFollowingIds((prev) => new Set([...prev, userId]));
      toast.success('Utilisateur suivi');
    } catch (error) {
      console.error(error);
    }
  };

  const handleUnfollow = async (userId: number) => {
    try {
      await api.delete(`/social/follow/${userId}`);
      setFollowingIds((prev) => {
        const n = new Set(prev);
        n.delete(userId);
        return n;
      });
      toast.success('Utilisateur retiré');
    } catch (error) {
      console.error(error);
    }
  };

  const cardCount = (deck: any) => {
    const main = deck.main_deck_count ?? deck.main_deck?.reduce((s: number, c: any) => s + c.quantity, 0) ?? 0;
    const extra = deck.extra_deck_count ?? deck.extra_deck?.reduce((s: number, c: any) => s + c.quantity, 0) ?? 0;
    const side = deck.side_deck_count ?? 0;
    return { main, extra, side };
  };

  // Wash colors selon deck id — palette de la maquette
  const washes = [
    'radial-gradient(ellipse at 80% 20%,rgba(245,197,24,.18),transparent 65%)',
    'radial-gradient(ellipse at 80% 20%,rgba(168,85,247,.22),transparent 65%)',
    'radial-gradient(ellipse at 80% 20%,rgba(34,211,238,.18),transparent 65%)',
    'radial-gradient(ellipse at 80% 20%,rgba(52,211,153,.16),transparent 65%)',
    'radial-gradient(ellipse at 80% 20%,rgba(255,46,136,.16),transparent 65%)',
  ];

  const sortTabs: Array<{ id: typeof sort; label: string }> = [
    { id: 'populaires', label: 'Populaires' },
    { id: 'recents', label: 'Récents' },
    { id: 'suivis', label: 'Suivis' },
  ];

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: 'transparent' }}>
      <AppBackground />
      <CornerOrnaments />
      <AppNavbar />

      <div style={{ position: 'relative', zIndex: 20, padding: '42px 40px 60px', maxWidth: 1440, margin: '0 auto' }}>
        {/* Header 2 cols */}
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
              — Vitrines ouvertes —
            </div>
            <h1
              style={{
                margin: '10px 0 0',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 'clamp(34px, 4vw, 46px)',
                fontWeight: 900,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                background: 'linear-gradient(180deg,var(--text) 25%,var(--gold-dim) 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}>
              Social
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {sortTabs.map((s) => {
              const on = sort === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setSort(s.id);
                    setDecksPage(1);
                  }}
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
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub tabs Decks / Users */}
        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          {[
            { id: 'decks' as const, label: 'Decks publics' },
            { id: 'users' as const, label: 'Trouver des gardiens' },
          ].map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '10px 18px',
                  background: 'transparent',
                  border: 0,
                  borderBottom: `2px solid ${on ? 'var(--gold)' : 'transparent'}`,
                  color: on ? 'var(--gold)' : 'var(--text-muted)',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'decks' && (
          <>
            <div
              style={{
                marginTop: 30,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 24,
              }}
              className="max-lg:!grid-cols-2 max-sm:!grid-cols-1">
              {decks.map((deck, idx) => {
                const c = cardCount(deck);
                const wash = washes[idx % washes.length];
                return (
                  <div
                    key={deck.id}
                    onClick={() => navigate(`/decks/${deck.id}`)}
                    style={{
                      background: 'linear-gradient(150deg,var(--panel),var(--bg-sunken))',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'transform 260ms cubic-bezier(.2,.8,.2,1),border-color 200ms',
                      clipPath: CUT_FEED,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-6px)';
                      e.currentTarget.style.borderColor = 'var(--gold-dim)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}>
                    {/* Image header 172px avec fan de 3 mini-cartes */}
                    <div
                      style={{
                        position: 'relative',
                        height: 172,
                        overflow: 'hidden',
                        background: 'linear-gradient(120deg,var(--panel-2),var(--bg))',
                      }}>
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background:
                            'repeating-linear-gradient(45deg,transparent 0 11px,rgba(168,85,247,.05) 11px 12px)',
                        }}
                      />
                      <div style={{ position: 'absolute', inset: 0, background: wash }} />
                      <div style={{ position: 'absolute', left: 26, top: 24, display: 'flex' }}>
                        <div
                          style={{
                            width: 76,
                            height: 114,
                            border: '1px solid rgba(245,197,24,.5)',
                            background: 'linear-gradient(150deg,var(--panel-2),var(--bg-elev))',
                            display: 'grid',
                            placeItems: 'center',
                            transform: 'rotate(-8deg)',
                            boxShadow: '0 14px 26px rgba(0,0,0,.6),0 0 20px rgba(245,197,24,.2)',
                          }}>
                          <CardIcon size={40} style={{ color: 'var(--gold)', opacity: 0.3 }} />
                        </div>
                        <div
                          style={{
                            width: 76,
                            height: 114,
                            border: '1px solid rgba(168,85,247,.5)',
                            background: 'linear-gradient(150deg,var(--panel-2),var(--bg-elev))',
                            display: 'grid',
                            placeItems: 'center',
                            marginLeft: -22,
                            transform: 'rotate(4deg)',
                            boxShadow: '0 14px 26px rgba(0,0,0,.6)',
                          }}>
                          <CardIcon size={40} style={{ color: 'var(--violet)', opacity: 0.34 }} />
                        </div>
                        <div
                          style={{
                            width: 76,
                            height: 114,
                            border: '1px solid rgba(34,211,238,.45)',
                            background: 'linear-gradient(150deg,var(--panel-2),var(--bg-elev))',
                            display: 'grid',
                            placeItems: 'center',
                            marginLeft: -22,
                            transform: 'rotate(14deg)',
                            boxShadow: '0 14px 26px rgba(0,0,0,.6)',
                          }}>
                          <CardIcon size={40} style={{ color: 'var(--cyan)', opacity: 0.3 }} />
                        </div>
                      </div>
                      <span
                        style={{
                          position: 'absolute',
                          right: 14,
                          top: 14,
                          padding: '4px 10px',
                          background: 'rgba(11,9,6,.82)',
                          border: '1px solid var(--border)',
                          color: 'var(--gold-dim)',
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 9,
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                        }}>
                        {(deck as any).archetype || 'Deck'}
                      </span>
                    </div>

                    <div style={{ padding: '18px 20px 20px' }}>
                      <div
                        style={{
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 17,
                          fontWeight: 700,
                          color: 'var(--text)',
                          letterSpacing: '0.02em',
                        }}>
                        {deck.name}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 14, color: 'var(--text-muted)' }}>
                        par <span style={{ color: 'var(--violet)' }}>@{deck.user?.username}</span>
                      </div>
                      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 18 }}>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: 12,
                            color: 'var(--magenta)',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                          ♥ {deck.likes_count || 0}
                        </span>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: 12,
                            color: 'var(--text-muted)',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                          💬 {deck.comments_count || 0}
                        </span>
                        <span style={{ flex: 1 }} />
                        <span
                          style={{
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: 12,
                            color: 'var(--gold)',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                          {c.main} · {c.extra} · {c.side}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {decksLoading && (
              <div className="text-center py-8">
                <div
                  className="inline-block animate-spin"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: '3px solid rgba(245,197,24,.3)',
                    borderTopColor: 'var(--gold)',
                  }}
                />
              </div>
            )}
            <div ref={decksLoadMoreRef} className="h-8" />

            {!decksLoading && decks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: 16 }}>
                Aucun deck à découvrir pour le moment.
              </div>
            )}
          </>
        )}

        {tab === 'users' && (
          <>
            <div style={{ marginTop: 24 }}>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Chercher un gardien…"
                style={{
                  width: '100%',
                  height: 52,
                  padding: '0 18px',
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderLeft: '3px solid var(--gold)',
                  color: 'var(--text)',
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: 16,
                  outline: 'none',
                }}
              />
            </div>
            <div
              style={{
                marginTop: 20,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 16,
              }}
              className="max-lg:!grid-cols-2 max-sm:!grid-cols-1">
              {users.map((u) => (
                <div
                  key={u.id}
                  style={{
                    padding: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    background: 'linear-gradient(150deg,var(--panel),var(--bg-sunken))',
                    border: '1px solid var(--border)',
                    clipPath: CUT_FEED,
                  }}>
                  {u.profile_picture ? (
                    <img
                      src={getImageUrl(u.profile_picture)}
                      alt={u.username}
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: 'cover',
                        border: '1px solid var(--gold-dim)',
                        clipPath: 'polygon(50% 0,100% 27%,100% 73%,50% 100%,0 73%,0 27%)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        background: 'linear-gradient(135deg,var(--violet),var(--gold-dim))',
                        color: 'var(--bg)',
                        display: 'grid',
                        placeItems: 'center',
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: 20,
                        fontWeight: 900,
                        clipPath: 'polygon(50% 0,100% 27%,100% 73%,50% 100%,0 73%,0 27%)',
                      }}>
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                      @{u.username}
                    </div>
                    <button
                      onClick={() => navigate(`/user/${u.id}`)}
                      style={{
                        marginTop: 4,
                        color: 'var(--violet)',
                        background: 'transparent',
                        border: 0,
                        fontSize: 11,
                        padding: 0,
                        cursor: 'pointer',
                        fontFamily: "'Orbitron', sans-serif",
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                      }}>
                      Voir profil →
                    </button>
                  </div>
                  {u.id !== user?.id &&
                    (followingIds.has(u.id) ? (
                      <button
                        onClick={() => handleUnfollow(u.id)}
                        style={{
                          padding: '8px 14px',
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 10,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          cursor: 'pointer',
                          clipPath: CUT_SM,
                        }}>
                        Suivi
                      </button>
                    ) : (
                      <button
                        onClick={() => handleFollow(u.id)}
                        style={{
                          padding: '8px 14px',
                          background: 'var(--gold)',
                          color: 'var(--bg)',
                          border: 0,
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 10,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          cursor: 'pointer',
                          clipPath: CUT_SM,
                        }}>
                        Suivre
                      </button>
                    ))}
                </div>
              ))}
            </div>
            {usersLoading && (
              <div className="text-center py-6" style={{ color: 'var(--text-muted)' }}>
                Recherche…
              </div>
            )}
            {!usersLoading && users.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
                {userSearch ? `Aucun gardien pour « ${userSearch} »` : 'Recherche un gardien à suivre'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Social;
