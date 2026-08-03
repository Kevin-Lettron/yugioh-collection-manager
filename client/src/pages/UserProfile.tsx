import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Deck } from '../../../shared/types';
import api, { getImageUrl } from '../services/api';
import toast from 'react-hot-toast';
import AppNavbar from '../components/AppNavbar';
import AppBackground from '../components/decor/AppBackground';
import CornerOrnaments from '../components/decor/CornerOrnaments';
import { GlyphEye } from '../components/decor/Glyphs';
import { CardIcon } from '../components/decor/Icons';

const CUT_BTN = 'polygon(0 0,100% 0,100% 100%,95% 100%,95% 90%,85% 90%,85% 100%,8% 100%,0 70%)';
const CUT_SM = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';
const CUT_STATS = 'polygon(0 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,14px 100%,0 calc(100% - 14px))';
const CUT_TILE = 'polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))';
const HEX = 'polygon(50% 0,100% 27%,100% 73%,50% 100%,0 73%,0 27%)';

/**
 * UserProfile — même layout que Profile mais version publique.
 * Pas de bouton Éditer, ajout d'un CTA « Suivre / Ne plus suivre » primary.
 */
const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [stats, setStats] = useState({ followersCount: 0, followingCount: 0 });

  const isOwn = currentUser && parseInt(userId || '0') === currentUser.id;

  useEffect(() => {
    if (userId) {
      fetchProfile();
      fetchDecks();
      if (!isOwn) checkFollowing();
    }
  }, [userId, currentUser]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/auth/users/${userId}`);
      setProfileUser(response.data.user);
      setStats({
        followersCount: response.data.followerCount || 0,
        followingCount: response.data.followingCount || 0,
      });
    } catch (error) {
      console.error(error);
      toast.error('Utilisateur introuvable');
      navigate('/social');
    } finally {
      setLoading(false);
    }
  };

  const fetchDecks = async () => {
    try {
      const response = await api.get('/decks/public', { params: { user_id: userId, limit: 50 } });
      setDecks(response.data.data || response.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const checkFollowing = async () => {
    try {
      const response = await api.get('/social/following');
      const following = response.data.following || response.data || [];
      setIsFollowing(following.some((f: any) => (f.following_id || f.id) === parseInt(userId!)));
    } catch (error) {
      console.error(error);
    }
  };

  const handleFollow = async () => {
    setFollowLoading(true);
    try {
      await api.post(`/social/follow/${userId}`);
      setIsFollowing(true);
      setStats((p) => ({ ...p, followersCount: p.followersCount + 1 }));
      toast.success('Suivi');
    } catch (error) {
      console.error(error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleUnfollow = async () => {
    setFollowLoading(true);
    try {
      await api.delete(`/social/follow/${userId}`);
      setIsFollowing(false);
      setStats((p) => ({ ...p, followersCount: Math.max(0, p.followersCount - 1) }));
      toast.success('Retiré');
    } catch (error) {
      console.error(error);
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'transparent' }}>
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
  if (!profileUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'transparent' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <h2 style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--text)', fontSize: 20 }}>Utilisateur introuvable</h2>
          <Link to="/social" style={{ color: 'var(--gold)' }}>Retour</Link>
        </div>
      </div>
    );
  }

  const initials = profileUser.username.slice(0, 2).toUpperCase();
  const profileStats = [
    { label: 'Cartes', value: '— À venir' },
    { label: 'Decks publics', value: String(decks.length) },
    { label: 'Abonnés', value: String(stats.followersCount) },
    { label: 'Copies de deck', value: '— À venir' },
  ];

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: 'transparent' }}>
      <AppBackground />
      <CornerOrnaments />
      <AppNavbar />

      <div style={{ position: 'relative', zIndex: 20 }}>
        <div
          style={{
            position: 'relative',
            height: 180,
            background: 'linear-gradient(120deg,rgba(168,85,247,.24),rgba(245,197,24,.1))',
            borderBottom: '1px solid var(--border)',
            overflow: 'hidden',
          }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(rgba(245,197,24,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(245,197,24,.07) 1px,transparent 1px)',
              backgroundSize: '34px 34px',
            }}
          />
          <GlyphEye
            style={{ position: 'absolute', right: 80, top: -30, width: 220, height: 220, color: 'var(--gold)', opacity: 0.12 }}
          />
        </div>

        <div style={{ padding: '0 40px 60px', maxWidth: 1440, margin: '0 auto' }}>
          <div style={{ marginTop: -56, display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
            {profileUser.profile_picture ? (
              <img
                src={getImageUrl(profileUser.profile_picture)}
                alt={profileUser.username}
                style={{
                  width: 120,
                  height: 120,
                  objectFit: 'cover',
                  border: '1px solid var(--gold)',
                  clipPath: HEX,
                  boxShadow: '0 0 40px rgba(245,197,24,.3)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 120,
                  height: 120,
                  background: 'linear-gradient(135deg,var(--violet),var(--gold-dim))',
                  color: 'var(--bg)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 38,
                  fontWeight: 900,
                  border: '1px solid var(--gold)',
                  clipPath: HEX,
                  boxShadow: '0 0 40px rgba(245,197,24,.3)',
                }}>
                {initials}
              </div>
            )}
            <div style={{ paddingBottom: 8, flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 30,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--text)',
                }}>
                @{profileUser.username}
              </div>
              <div style={{ marginTop: 6, fontSize: 15, color: 'var(--text-muted)' }}>
                Gardien du sanctuaire · depuis {new Date(profileUser.created_at).getFullYear()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, paddingBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '6px 12px',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}>
                Top 5 % — À venir
              </span>
              <span
                style={{
                  padding: '6px 12px',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}>
                1 000 scans — À venir
              </span>
              {!isOwn && (
                isFollowing ? (
                  <button
                    onClick={handleUnfollow}
                    disabled={followLoading}
                    style={{
                      height: 44,
                      padding: '0 20px',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      color: 'var(--text-muted)',
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 11,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      cursor: followLoading ? 'not-allowed' : 'pointer',
                      clipPath: CUT_SM,
                    }}>
                    Suivi
                  </button>
                ) : (
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    style={{
                      height: 44,
                      padding: '0 22px',
                      position: 'relative',
                      isolation: 'isolate',
                      border: 0,
                      background: 'transparent',
                      color: 'var(--bg)',
                      fontFamily: "'Orbitron', sans-serif",
                      fontWeight: 700,
                      fontSize: 11,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      cursor: followLoading ? 'not-allowed' : 'pointer',
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
                    Suivre
                  </button>
                )
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: 30,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 1,
              background: 'var(--border)',
              border: '1px solid var(--border)',
              clipPath: CUT_STATS,
            }}
            className="max-md:!grid-cols-2">
            {profileStats.map((s) => (
              <div
                key={s.label}
                style={{
                  padding: '18px 22px',
                  background: 'linear-gradient(135deg,var(--panel),var(--panel-2))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                <span
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 9,
                    letterSpacing: '0.2em',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}>
                  {s.label}
                </span>
                <span
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 26,
                    fontWeight: 700,
                    color: 'var(--text)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 34, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 12,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--gold)',
              }}>
              Ses decks publics
            </span>
            <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border),transparent)' }} />
          </div>

          {decks.length === 0 ? (
            <div style={{ marginTop: 24, textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: 14, border: '1px dashed var(--border)' }}>
              {profileUser.username} n'a pas encore de deck public.
            </div>
          ) : (
            <div
              style={{
                marginTop: 18,
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 20,
              }}
              className="max-lg:!grid-cols-3 max-md:!grid-cols-2 max-sm:!grid-cols-1">
              {decks.map((d) => {
                const main = d.main_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
                const extra = d.extra_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
                return (
                  <Link key={d.id} to={`/decks/${d.id}`} style={{ textDecoration: 'none' }}>
                    <div
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
                        {d.name}
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
                          {main} · {extra} · 0
                        </span>
                        <span style={{ color: 'var(--magenta)' }}>♥ {d.likes_count || 0}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
