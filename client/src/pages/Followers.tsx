import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User } from '../../../shared/types';
import api, { getImageUrl } from '../services/api';
import toast from 'react-hot-toast';
import AppNavbar from '../components/AppNavbar';
import ChallengeModal from '../components/ChallengeModal';

/**
 * `/followers?tab=followers|following` — hub des connexions sociales.
 *
 * Deux onglets miroirs (Abonnés / Abonnements). Chaque ligne = avatar,
 * pastille de présence (vert si actif < 2 min, gris sinon), timestamp
 * "vu à …", bouton "Défier en duel" (violet) et action follow/unfollow.
 *
 * Le back renvoie `last_seen` + `is_online` dans /social/{followers,following}
 * depuis la migration 013 — pas de calcul côté client.
 */

// ── Rendu pastille + label "vu à …" ────────────────────────────────────────
function formatLastSeen(iso?: string | null): string {
  if (!iso) return 'Jamais vu';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Jamais vu';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `vu il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vu il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `vu il y a ${days} j`;
  return `vu le ${new Date(iso).toLocaleDateString('fr-FR')}`;
}

type SocialUser = Partial<User> & { id: number; username: string; is_online?: boolean; last_seen?: string | null };

const Followers = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'following' ? 'following' : 'followers';
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);

  useEffect(() => {
    const current = searchParams.get('tab');
    if (current !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', activeTab);
      setSearchParams(next, { replace: true });
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const [followers, setFollowers] = useState<SocialUser[]>([]);
  const [following, setFollowing] = useState<SocialUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [challengeTarget, setChallengeTarget] = useState<{ id: number; username: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [followersRes, followingRes] = await Promise.all([
        api.get('/social/followers'),
        api.get('/social/following'),
      ]);
      setFollowers(followersRes.data.followers ?? []);
      setFollowing(followingRes.data.following ?? []);
    } catch (error) {
      console.error('Failed to fetch followers/following:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refetch périodique : les pastilles online doivent respirer sans reload.
    // 30 s suffit — les changements de présence sont peu bruyants.
    const iv = window.setInterval(fetchData, 30_000);
    return () => window.clearInterval(iv);
  }, []);

  const followingIds = useMemo(
    () => new Set<number>(following.map((f) => f.id)),
    [following]
  );

  const handleUnfollow = async (userId: number) => {
    try {
      await api.delete(`/social/follow/${userId}`);
      toast.success('Ne suit plus');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFollow = async (userId: number) => {
    try {
      await api.post(`/social/follow/${userId}`);
      toast.success('Duelliste suivi');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const renderRow = (u: SocialUser, isFollowingTab: boolean) => {
    if (!u?.id) return null;
    const isSelf = u.id === user?.id;
    const isOnline = Boolean(u.is_online);
    const iFollow = followingIds.has(u.id);

    return (
      <div
        key={u.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 16px',
          background: 'linear-gradient(160deg,#1A1510,#0F0C07)',
          border: `1px solid ${isOnline ? '#4ADE80' : '#3A2E1C'}`,
          borderLeftWidth: 3,
          borderLeftColor: isOnline ? '#4ADE80' : '#3A2E1C',
          transition: 'border-color 200ms, transform 180ms',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
        }}>
        {/* Avatar */}
        <div
          onClick={() => navigate(`/profile/${u.id}`)}
          style={{ position: 'relative', width: 56, height: 56, flexShrink: 0, cursor: 'pointer' }}>
          {u.profile_picture ? (
            <img
              src={getImageUrl(u.profile_picture)}
              alt={u.username}
              style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '1px solid #3A2E1C' }}
            />
          ) : (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#A855F7,#5A4D2E)',
                display: 'grid',
                placeItems: 'center',
                color: '#F5EFE0',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 18,
                fontWeight: 900,
                border: '1px solid #3A2E1C',
              }}>
              {(u.username || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
          {/* Pastille online — coin bas-droit */}
          <span
            title={isOnline ? 'En ligne' : 'Hors ligne'}
            style={{
              position: 'absolute',
              right: 0,
              bottom: 2,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: isOnline ? '#4ADE80' : '#6B5A3E',
              border: '2px solid #0F0C07',
              boxShadow: isOnline ? '0 0 8px rgba(74,222,128,.7)' : 'none',
            }}
          />
        </div>

        {/* Identite + presence */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => navigate(`/profile/${u.id}`)}
              style={{
                background: 'transparent',
                border: 0,
                padding: 0,
                color: '#F5EFE0',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                textAlign: 'left',
              }}>
              @{u.username}
            </button>
            <span
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 999,
                background: isOnline ? 'rgba(74,222,128,.15)' : 'rgba(107,90,62,.15)',
                color: isOnline ? '#4ADE80' : '#A99C86',
                fontFamily: "'Orbitron', sans-serif",
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}>
              {isOnline ? '● En ligne' : '○ Hors ligne'}
            </span>
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: 12,
              color: '#A99C86',
              fontFamily: "'Rajdhani', sans-serif",
            }}>
            {isOnline ? 'Actif maintenant' : formatLastSeen(u.last_seen)}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!isSelf && (
            <button
              onClick={() => setChallengeTarget({ id: u.id, username: u.username })}
              title="Défier en duel"
              style={{
                height: 36,
                padding: '0 14px',
                background: 'linear-gradient(135deg,#A855F7,#7C3AED)',
                border: '1px solid #A855F7',
                color: '#F5EFE0',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 0 12px rgba(168,85,247,.35)',
              }}>
              <span style={{ fontSize: 14 }}>⚔</span>
              Défier
            </button>
          )}
          {!isSelf && isFollowingTab && iFollow && (
            <button
              onClick={() => handleUnfollow(u.id)}
              style={{
                height: 36,
                padding: '0 12px',
                background: 'transparent',
                border: '1px solid #3A2E1C',
                color: '#A99C86',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 700,
                cursor: 'pointer',
              }}>
              Ne plus suivre
            </button>
          )}
          {!isSelf && !isFollowingTab && !iFollow && (
            <button
              onClick={() => handleFollow(u.id)}
              style={{
                height: 36,
                padding: '0 12px',
                background: 'transparent',
                border: '1px solid #F5C518',
                color: '#F5C518',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 700,
                cursor: 'pointer',
              }}>
              Suivre en retour
            </button>
          )}
        </div>
      </div>
    );
  };

  const list = activeTab === 'followers' ? followers : following;

  return (
    <div style={{ minHeight: '100vh', background: '#0B0906' }}>
      <AppNavbar />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '30px 20px 60px' }}>
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: 'italic',
              fontSize: 12,
              letterSpacing: '0.32em',
              color: '#F5C518',
              textTransform: 'uppercase',
            }}>
            — Cercle des duellistes —
          </div>
          <h1
            style={{
              margin: '10px 0 6px',
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 900,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              color: '#F5EFE0',
            }}>
            Connexions
          </h1>
          <p style={{ margin: 0, color: '#A99C86', fontSize: 14 }}>
            Suis les autres duellistes, vois qui est en ligne et lance un défi en un clic.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #3A2E1C', marginBottom: 20 }}>
          {(['followers', 'following'] as const).map((t) => {
            const on = activeTab === t;
            const count = t === 'followers' ? followers.length : following.length;
            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  padding: '10px 18px',
                  background: 'transparent',
                  border: 0,
                  borderBottom: `2px solid ${on ? '#F5C518' : 'transparent'}`,
                  color: on ? '#F5C518' : '#A99C86',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 12,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontWeight: on ? 700 : 500,
                  cursor: 'pointer',
                }}>
                {t === 'followers' ? 'Abonnés' : 'Abonnements'} ({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div
              className="animate-spin"
              style={{
                display: 'inline-block',
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: '3px solid rgba(245,197,24,.3)',
                borderTopColor: '#F5C518',
              }}
            />
          </div>
        ) : list.length === 0 ? (
          <div
            style={{
              padding: '50px 20px',
              textAlign: 'center',
              border: '1px dashed #3A2E1C',
              color: '#A99C86',
            }}>
            <p style={{ margin: 0, fontSize: 15 }}>
              {activeTab === 'followers'
                ? "Personne ne te suit encore. Partage un deck public pour attirer l'attention."
                : "Tu ne suis personne. Explore le fil social pour trouver des duellistes."}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {list.map((u) => renderRow(u, activeTab === 'following'))}
          </div>
        )}
      </div>

      {/* Modal Défi — pré-rempli avec l'user cliqué */}
      {challengeTarget && (
        <ChallengeModal
          open={true}
          onClose={() => setChallengeTarget(null)}
          opponent={challengeTarget}
          onSuccess={() => setChallengeTarget(null)}
        />
      )}
    </div>
  );
};

export default Followers;
