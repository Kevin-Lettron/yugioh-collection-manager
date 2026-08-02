import { useState, useEffect, ChangeEvent, useRef, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Deck } from '../../../shared/types';
import api, { getImageUrl } from '../services/api';
import toast from 'react-hot-toast';
import AppNavbar from '../components/AppNavbar';
import AppBackground from '../components/decor/AppBackground';
import CornerOrnaments from '../components/decor/CornerOrnaments';
import { GlyphEye } from '../components/decor/Glyphs';
import { CardIcon, CheckIcon } from '../components/decor/Icons';

const CUT_SM = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';
const CUT_STATS = 'polygon(0 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,14px 100%,0 calc(100% - 14px))';
const CUT_TILE = 'polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))';
const HEX = 'polygon(50% 0,100% 27%,100% 73%,50% 100%,0 73%,0 27%)';

/**
 * Profile — pixel-perfect `isProfile` (DesktopFrame l.469-517).
 * Hero band 180px dégradé violet→or + quadrillage, avatar hex 120px overlap -56px,
 * infos user, badges Top 5% + 1000 scans (« À venir » car pas de data),
 * grid 4 cols profileStats biseautée, section « Ses decks publics » grid 4 cols.
 */
const Profile = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profilePicture, setProfilePicture] = useState(user?.profile_picture || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [stats, setStats] = useState({
    totalCards: 0,
    totalDecks: 0,
    followersCount: 0,
    followingCount: 0,
  });
  const [decks, setDecks] = useState<Deck[]>([]);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
      setProfilePicture(user.profile_picture || '');
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
    fetchMyDecks();
  }, []);

  const fetchStats = async () => {
    try {
      const [cardsRes, decksRes, followersRes, followingRes] = await Promise.all([
        api.get('/collection/cards', { params: { limit: 1 } }).catch(() => ({ data: { total: 0 } })),
        api.get('/decks', { params: { limit: 1 } }).catch(() => ({ data: { total: 0 } })),
        api.get('/social/followers').catch(() => ({ data: { followers: [], total: 0 } })),
        api.get('/social/following').catch(() => ({ data: { following: [], total: 0 } })),
      ]);
      const followersData = followersRes.data.followers || followersRes.data || [];
      const followingData = followingRes.data.following || followingRes.data || [];
      setStats({
        totalCards: cardsRes.data.total || 0,
        totalDecks: decksRes.data.total || decksRes.data.data?.length || decksRes.data.length || 0,
        followersCount: followersRes.data.total || followersData.length || 0,
        followingCount: followingRes.data.total || followingData.length || 0,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const fetchMyDecks = async () => {
    try {
      const response = await api.get('/decks', { params: { is_public: true } });
      setDecks(response.data.data || response.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Fichier image uniquement');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image doit faire moins de 5 Mo");
      return;
    }
    const formData = new FormData();
    formData.append('profile_picture', file);
    setUploading(true);
    try {
      const response = await api.post('/auth/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updated: User = response.data.user;
      setProfilePicture(updated.profile_picture || '');
      updateUser(updated);
      toast.success('Avatar mis à jour');
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || username.length < 3) {
      toast.error('Pseudo trop court');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast.error('Sceaux différents');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      toast.error('Sceau trop court');
      return;
    }
    setLoading(true);
    try {
      const data: any = { username };
      if (newPassword) data.password = newPassword;
      const response = await api.put('/auth/profile', data);
      updateUser(response.data.user);
      toast.success('Profil mis à jour');
      setEditing(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
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

  const initials = (username.match(/[A-Z]/g) || username.slice(0, 2).toUpperCase().split('')).slice(0, 2).join('');

  const profileStats = [
    { label: 'Cartes', value: stats.totalCards.toLocaleString('fr-FR') },
    { label: 'Decks publics', value: String(stats.totalDecks) },
    { label: 'Abonnés', value: String(stats.followersCount) },
    { label: 'Copies de deck', value: '— À venir' },
  ];

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: '#0B0906' }}>
      <AppBackground />
      <CornerOrnaments />
      <AppNavbar />

      <div style={{ position: 'relative', zIndex: 20 }}>
        {/* Hero band 180px */}
        <div
          style={{
            position: 'relative',
            height: 180,
            background: 'linear-gradient(120deg,rgba(168,85,247,.24),rgba(245,197,24,.1))',
            borderBottom: '1px solid #3A2E1C',
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
            style={{ position: 'absolute', right: 80, top: -30, width: 220, height: 220, color: '#F5C518', opacity: 0.12 }}
          />
        </div>

        <div style={{ padding: '0 40px 60px', maxWidth: 1440, margin: '0 auto' }}>
          {/* Bloc user (overlap) */}
          <div style={{ marginTop: -56, display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
            {profilePicture ? (
              <img
                src={getImageUrl(profilePicture)}
                alt={username}
                style={{
                  width: 120,
                  height: 120,
                  objectFit: 'cover',
                  border: '1px solid #F5C518',
                  clipPath: HEX,
                  boxShadow: '0 0 40px rgba(245,197,24,.3)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 120,
                  height: 120,
                  background: 'linear-gradient(135deg,#A855F7,#C29A0F)',
                  color: '#0B0906',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 38,
                  fontWeight: 900,
                  border: '1px solid #F5C518',
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
                  color: '#F5EFE0',
                }}>
                @{username}
              </div>
              <div style={{ marginTop: 6, fontSize: 15, color: '#A99C86' }}>
                Gardien du sanctuaire · depuis {new Date(user.created_at).getFullYear()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, paddingBottom: 8, alignItems: 'center' }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  border: '1px solid #3A2E1C',
                  color: '#A99C86',
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
                  border: '1px solid #3A2E1C',
                  color: '#A99C86',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}>
                1 000 scans — À venir
              </span>
              <button
                onClick={() => {
                  setEditing(true);
                  fileInputRef.current?.click();
                }}
                disabled={uploading}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  border: '1px solid #F5C518',
                  color: '#F5C518',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  cursor: 'pointer',
                  clipPath: CUT_SM,
                }}
                data-edit-profile>
                {uploading ? '...' : 'Éditer'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* 4 stats biseautées */}
          <div
            style={{
              marginTop: 30,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 1,
              background: '#3A2E1C',
              border: '1px solid #3A2E1C',
              clipPath: CUT_STATS,
            }}
            className="max-md:!grid-cols-2">
            {profileStats.map((s) => (
              <div
                key={s.label}
                style={{
                  padding: '18px 22px',
                  background: 'linear-gradient(135deg,#1A1510,#221B12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                <span
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 9,
                    letterSpacing: '0.2em',
                    color: '#A99C86',
                    textTransform: 'uppercase',
                  }}>
                  {s.label}
                </span>
                <span
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 26,
                    fontWeight: 700,
                    color: '#F5EFE0',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          {/* Edit form inline */}
          {editing && (
            <form
              onSubmit={handleSubmit}
              style={{
                marginTop: 30,
                padding: 22,
                background: 'linear-gradient(150deg,#1A1510,#0F0C07)',
                border: '1px solid #3A2E1C',
                clipPath: 'polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px))',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
              <div
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 12,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: '#F5C518',
                }}>
                Éditer le profil
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Pseudo"
                style={{
                  padding: '12px 14px',
                  background: '#14100A',
                  border: '1px solid #3A2E1C',
                  borderLeft: '2px solid #F5C518',
                  color: '#F5EFE0',
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <input
                type="email"
                value={email}
                disabled
                style={{
                  padding: '12px 14px',
                  background: '#0F0C07',
                  border: '1px solid #3A2E1C',
                  color: '#6E6250',
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: 14,
                }}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nouveau sceau (facultatif)"
                style={{
                  padding: '12px 14px',
                  background: '#14100A',
                  border: '1px solid #3A2E1C',
                  color: '#F5EFE0',
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              {newPassword && (
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmer le sceau"
                  style={{
                    padding: '12px 14px',
                    background: '#14100A',
                    border: '1px solid #3A2E1C',
                    color: '#F5EFE0',
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  style={{
                    flex: 1,
                    height: 44,
                    background: '#14100A',
                    color: '#A99C86',
                    border: '1px solid #3A2E1C',
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    clipPath: CUT_SM,
                  }}>
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    height: 44,
                    background: '#F5C518',
                    color: '#0B0906',
                    border: 0,
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    clipPath: CUT_SM,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}>
                  <CheckIcon size={12} />
                  Enregistrer
                </button>
              </div>
            </form>
          )}

          {/* Section Ses decks publics */}
          <div style={{ marginTop: 34, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 12,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#F5C518',
              }}>
              Mes decks publics
            </span>
            <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,#3A2E1C,transparent)' }} />
          </div>
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
                <Link
                  key={d.id}
                  to={`/decks/${d.id}`}
                  style={{ textDecoration: 'none' }}>
                  <div
                    style={{
                      padding: 18,
                      background: 'linear-gradient(150deg,#1A1510,#0F0C07)',
                      border: '1px solid #3A2E1C',
                      cursor: 'pointer',
                      transition: 'transform 240ms cubic-bezier(.2,.8,.2,1),border-color 200ms',
                      clipPath: CUT_TILE,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-6px)';
                      e.currentTarget.style.borderColor = '#C29A0F';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = '#3A2E1C';
                    }}>
                    <div style={{ height: 78, display: 'flex', alignItems: 'center' }}>
                      <div
                        style={{
                          width: 52,
                          height: 74,
                          border: '1px solid rgba(245,197,24,.42)',
                          background: 'linear-gradient(150deg,#221B12,#14100A)',
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
                          background: 'linear-gradient(150deg,#221B12,#14100A)',
                          marginLeft: -18,
                          transform: 'rotate(7deg)',
                          display: 'grid',
                          placeItems: 'center',
                        }}>
                        <CardIcon size={20} style={{ color: '#A855F7' }} />
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 12,
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#F5EFE0',
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
                        color: '#A99C86',
                      }}>
                      <span style={{ fontFamily: "'Orbitron', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                        {main} · {extra} · 0
                      </span>
                      <span style={{ color: '#FF2E88' }}>♥ {d.likes_count || 0}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
            <div
              onClick={() => navigate('/decks/new')}
              style={{
                padding: 18,
                border: '1px dashed #3A2E1C',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                minHeight: 190,
                cursor: 'pointer',
                transition: 'border-color 200ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#C29A0F')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#3A2E1C')}>
              <CardIcon size={40} style={{ color: '#C29A0F', opacity: 0.6 }} />
              <span
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  color: '#A99C86',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                }}>
                Dresser un deck
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
