import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Deck, Duel } from '../../../shared/types';
import api, { getImageUrl } from '../services/api';
import duelApi from '../services/duelApi';
import AppNavbar from '../components/AppNavbar';
import AppBackground from '../components/decor/AppBackground';
import CornerOrnaments from '../components/decor/CornerOrnaments';
import { GlyphPyramid } from '../components/decor/Glyphs';

const CUT_BTN = 'polygon(0 0,100% 0,100% 100%,95% 100%,95% 90%,85% 90%,85% 100%,8% 100%,0 70%)';
const CUT_SM = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';
const CUT_CHIP = 'polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)';
const CUT_TILE = 'polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px))';
const CUT_PANEL = 'polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,22px 100%,0 calc(100% - 22px))';
const HEX = 'polygon(50% 0,100% 27%,100% 73%,50% 100%,0 73%,0 27%)';

type TabId = 'pending' | 'active' | 'finished';

/**
 * Duels — hub des défis lancés & reçus.
 * 3 onglets biseautés (En attente / En cours / Terminés).
 * Grille 2 cols de duel-cards avec avatars hex + « VS » central.
 * Sub-chip flottant « M'a défié » quand une notif duel:challenged arrive live.
 */
const Duels = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>('pending');
  const [duels, setDuels] = useState<Duel[]>([]);
  const [loading, setLoading] = useState(true);
  const [incomingCount, setIncomingCount] = useState(0);
  const [showFlash, setShowFlash] = useState(false);

  // Accept modal (inline)
  const [acceptFor, setAcceptFor] = useState<Duel | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [acceptDeckId, setAcceptDeckId] = useState<number | null>(null);
  const [acceptDeckOpen, setAcceptDeckOpen] = useState(false);
  const [acceptSubmitting, setAcceptSubmitting] = useState(false);
  const deckRef = useRef<HTMLDivElement>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const list = await duelApi.listMine();
      setDuels(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Realtime : nouveaux défis reçus + toast + flash chip
  useEffect(() => {
    const off = duelApi.subscribeToChallenges({
      onChallenged: ({ duel }) => {
        setDuels((prev) => {
          if (prev.some((d) => d.id === duel.id)) return prev;
          return [duel, ...prev];
        });
        setIncomingCount((n) => n + 1);
        setShowFlash(true);
        toast.success(`@${duel.challenger?.username || 'quelqu\'un'} t'a défié`);
        window.setTimeout(() => setShowFlash(false), 6000);
      },
      onRejected: ({ duelId }) => {
        setDuels((prev) => prev.filter((d) => d.id !== duelId));
      },
      onCancelled: ({ duelId }) => {
        setDuels((prev) => prev.filter((d) => d.id !== duelId));
      },
    });
    return off;
  }, []);

  // Charge mes decks quand j'ouvre la modal d'acceptation
  useEffect(() => {
    if (!acceptFor) return;
    setDecksLoading(true);
    api
      .get('/decks')
      .then((res) => {
        const list: Deck[] = res.data.data || res.data || [];
        setDecks(list);
        if (list.length > 0) setAcceptDeckId(list[0].id);
      })
      .catch(() => setDecks([]))
      .finally(() => setDecksLoading(false));
  }, [acceptFor]);

  useEffect(() => {
    if (!acceptDeckOpen) return;
    const onClick = (e: MouseEvent) => {
      if (deckRef.current && !deckRef.current.contains(e.target as Node)) setAcceptDeckOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [acceptDeckOpen]);

  useEffect(() => {
    if (!acceptFor) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAcceptFor(null);
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [acceptFor]);

  const grouped = useMemo(() => {
    const g: Record<TabId, Duel[]> = { pending: [], active: [], finished: [] };
    for (const d of duels) {
      if (d.status === 'pending') g.pending.push(d);
      else if (d.status === 'active') g.active.push(d);
      else if (d.status === 'finished' || d.status === 'cancelled') g.finished.push(d);
    }
    // tri : plus récent d'abord
    for (const k of Object.keys(g) as TabId[]) {
      g[k].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    return g;
  }, [duels]);

  const shown = grouped[tab];

  const handleAccept = async () => {
    if (!acceptFor || !acceptDeckId) {
      toast.error('Choisis un deck');
      return;
    }
    setAcceptSubmitting(true);
    try {
      await duelApi.accept(acceptFor.id, acceptDeckId);
      toast.success('Duel accepté — salle d\'attente');
      const id = acceptFor.id;
      setAcceptFor(null);
      await fetchAll();
      // On passe par la salle d'attente : chaque joueur y confirme deck + prêt
      // avant que le pile ou face ne s'enclenche.
      navigate(`/duel/${id}/lobby`);
    } catch (err) {
      console.error(err);
    } finally {
      setAcceptSubmitting(false);
    }
  };

  const handleReject = async (duel: Duel) => {
    try {
      await duelApi.reject(duel.id);
      toast.success('Défi refusé');
      setDuels((prev) => prev.filter((d) => d.id !== duel.id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = async (duel: Duel) => {
    try {
      await duelApi.cancel(duel.id);
      toast.success('Défi annulé');
      setDuels((prev) => prev.filter((d) => d.id !== duel.id));
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (d: Date | string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h}h`;
    const days = Math.floor(h / 24);
    if (days < 7) return `il y a ${days}j`;
    return date.toLocaleDateString('fr-FR');
  };

  const renderCard = (d: Duel) => {
    const meIsChallenger = user?.id === d.challenger_id;
    const opponent = meIsChallenger ? d.opponent : d.challenger;
    const me = meIsChallenger ? d.challenger : d.opponent;
    const isPending = d.status === 'pending';
    const isActive = d.status === 'active';
    const isFinished = d.status === 'finished';
    const iWin = isFinished && d.winner_id === user?.id;
    const iLose = isFinished && d.winner_id != null && d.winner_id !== user?.id;
    const isCancelled = d.status === 'cancelled';

    const statusColor = isPending
      ? '#F5C518'
      : isActive
      ? '#A855F7'
      : iWin
      ? '#F5C518'
      : iLose
      ? '#FF2E88'
      : '#A99C86';
    const statusLabel = isPending
      ? meIsChallenger
        ? 'En attente'
        : 'M\'a défié'
      : isActive
      ? 'En cours'
      : isCancelled
      ? 'Annulé'
      : iWin
      ? 'Victoire'
      : iLose
      ? 'Défaite'
      : 'Terminé';

    return (
      <div
        key={d.id}
        style={{
          position: 'relative',
          padding: 20,
          background: 'linear-gradient(160deg,#1A1510,#0F0C07)',
          border: `1px solid ${isPending ? '#C29A0F' : isActive ? '#A855F7' : '#3A2E1C'}`,
          clipPath: CUT_TILE,
          transition: 'border-color 200ms, transform 240ms cubic-bezier(.2,.8,.2,1), box-shadow 200ms',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = `0 20px 40px rgba(0,0,0,.5), 0 0 24px ${statusColor}44`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}>
        {/* Grille or discrète */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(245,197,24,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(245,197,24,.04) 1px,transparent 1px)',
            backgroundSize: '28px 28px',
            pointerEvents: 'none',
            clipPath: CUT_TILE,
          }}
        />

        {/* Badge statut + date */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            position: 'relative',
          }}>
          <span
            style={{
              padding: '5px 12px',
              background:
                isPending
                  ? 'rgba(245,197,24,.15)'
                  : isActive
                  ? 'rgba(168,85,247,.18)'
                  : iWin
                  ? 'linear-gradient(135deg,#F5C518,#C29A0F)'
                  : iLose
                  ? 'rgba(255,46,136,.18)'
                  : 'transparent',
              border: `1px solid ${statusColor}`,
              color: iWin ? '#0B0906' : statusColor,
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 9,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontWeight: 700,
              clipPath: CUT_CHIP,
            }}>
            {statusLabel}
          </span>
          <span
            style={{
              fontSize: 11,
              color: '#6B5A3E',
              fontFamily: "'Rajdhani', sans-serif",
              letterSpacing: '0.05em',
            }}>
            {formatDate(d.updated_at)}
          </span>
        </div>

        {/* Duellistes : avatars hex + VS */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            marginTop: 4,
            position: 'relative',
          }}>
          {/* Moi */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {renderAvatar(me?.profile_picture, me?.username || 'moi', '#F5C518')}
            <div
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#F5EFE0',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}>
              @{me?.username || 'moi'}
            </div>
            {isFinished && (
              <span
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 13,
                  fontVariantNumeric: 'tabular-nums',
                  color: iWin ? '#F5C518' : '#A99C86',
                  fontWeight: 700,
                }}>
                {meIsChallenger ? d.challenger_lp : d.opponent_lp} LP
              </span>
            )}
          </div>

          {/* VS */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              flex: 'none',
            }}>
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: 'italic',
                fontSize: 28,
                fontWeight: 700,
                color: '#F5C518',
                textShadow: '0 0 12px rgba(245,197,24,.4)',
                lineHeight: 1,
              }}>
              VS
            </span>
            {isActive && (
              <span
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 8,
                  letterSpacing: '0.16em',
                  color: '#A855F7',
                  textTransform: 'uppercase',
                }}>
                Tour {d.turn_number}
              </span>
            )}
          </div>

          {/* Adversaire */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {renderAvatar(opponent?.profile_picture, opponent?.username || '?', '#A855F7')}
            <div
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#F5EFE0',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}>
              @{opponent?.username || '?'}
            </div>
            {isFinished && (
              <span
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 13,
                  fontVariantNumeric: 'tabular-nums',
                  color: iLose ? '#FF2E88' : '#A99C86',
                  fontWeight: 700,
                }}>
                {meIsChallenger ? d.opponent_lp : d.challenger_lp} LP
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            justifyContent: 'center',
            position: 'relative',
          }}>
          {isPending && !meIsChallenger && (
            <>
              <button
                onClick={() => setAcceptFor(d)}
                style={{
                  height: 40,
                  padding: '0 20px',
                  position: 'relative',
                  isolation: 'isolate',
                  border: 0,
                  background: 'transparent',
                  color: '#0B0906',
                  fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 700,
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}>
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#A855F7',
                    transform: 'translate(4px,0)',
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
                Accepter
              </button>
              <button
                onClick={() => handleReject(d)}
                style={{
                  height: 40,
                  padding: '0 16px',
                  border: '1px solid #FF2E88',
                  background: 'transparent',
                  color: '#FF9AAF',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  cursor: 'pointer',
                  clipPath: CUT_SM,
                }}>
                Refuser
              </button>
            </>
          )}
          {isPending && meIsChallenger && (
            <button
              onClick={() => handleCancel(d)}
              style={{
                height: 40,
                padding: '0 20px',
                border: '1px solid #3A2E1C',
                background: 'transparent',
                color: '#A99C86',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 700,
                cursor: 'pointer',
                clipPath: CUT_SM,
              }}>
              Annuler mon défi
            </button>
          )}
          {isActive && (
            <button
              onClick={() => {
                // Si le duel est active mais pas encore en pile ou face, on
                // atterrit d'abord dans la salle d'attente.
                const target =
                  d.phase_pre_game || d.first_player_id
                    ? `/duel/${d.id}`
                    : `/duel/${d.id}/lobby`;
                navigate(target);
              }}
              style={{
                height: 42,
                padding: '0 22px',
                background: 'linear-gradient(135deg,#A855F7,#7C3AED)',
                border: 0,
                color: '#F5EFE0',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 700,
                cursor: 'pointer',
                clipPath: CUT_SM,
                boxShadow: '0 0 18px rgba(168,85,247,.4)',
              }}>
              Reprendre le duel →
            </button>
          )}
          {isFinished && (
            <button
              onClick={() => navigate(`/duel/${d.id}`)}
              style={{
                height: 40,
                padding: '0 18px',
                border: '1px solid #3A2E1C',
                background: 'transparent',
                color: '#A99C86',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 700,
                cursor: 'pointer',
                clipPath: CUT_SM,
              }}>
              Revoir le duel
            </button>
          )}
        </div>
      </div>
    );
  };

  const acceptSelectedDeck = decks.find((x) => x.id === acceptDeckId);

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: '#0B0906' }}>
      <AppBackground />
      <CornerOrnaments />
      <AppNavbar />

      <div style={{ position: 'relative', zIndex: 20, padding: '46px 40px 60px', maxWidth: 1240, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ position: 'relative', paddingBottom: 30, borderBottom: '1px solid #3A2E1C' }}>
          <GlyphPyramid
            style={{ position: 'absolute', right: 0, top: -16, width: 150, height: 150, color: '#A855F7', opacity: 0.08 }}
          />
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: 'italic',
              fontSize: 12,
              letterSpacing: '0.32em',
              color: '#F5C518',
              textTransform: 'uppercase',
            }}>
            — Arène des duellistes —
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
              background: 'linear-gradient(180deg,#F5EFE0 25%,#C29A0F 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 0 18px rgba(168,85,247,.2))',
            }}>
            Duels
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: 16, color: '#A99C86' }}>
            {duels.length} défi{duels.length > 1 ? 's' : ''} en mémoire du Sanctuaire
          </p>

          {/* Onglets */}
          <div style={{ marginTop: 22, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(
              [
                { id: 'pending' as TabId, label: 'En attente', count: grouped.pending.length },
                { id: 'active' as TabId, label: 'En cours', count: grouped.active.length },
                { id: 'finished' as TabId, label: 'Terminés', count: grouped.finished.length },
              ]
            ).map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: '10px 18px',
                    border: `1px solid ${on ? '#F5C518' : '#3A2E1C'}`,
                    background: on ? 'linear-gradient(135deg,#F5C518,#C29A0F)' : '#1A1510',
                    color: on ? '#0B0906' : '#A99C86',
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    fontWeight: on ? 700 : 500,
                    cursor: 'pointer',
                    clipPath: CUT_CHIP,
                    boxShadow: on ? '0 0 12px rgba(245,197,24,.35)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                  <span>{t.label}</span>
                  <span
                    style={{
                      padding: '1px 8px',
                      background: on ? 'rgba(11,9,6,.28)' : 'rgba(245,197,24,.12)',
                      color: on ? '#0B0906' : '#F5C518',
                      fontSize: 10,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      minWidth: 20,
                      textAlign: 'center',
                    }}>
                    {t.count}
                  </span>
                </button>
              );
            })}

            {showFlash && incomingCount > 0 && (
              <button
                onClick={() => {
                  setTab('pending');
                  setShowFlash(false);
                }}
                style={{
                  marginLeft: 6,
                  padding: '10px 16px',
                  border: '1px solid #FF2E88',
                  background: 'rgba(255,46,136,.15)',
                  color: '#FF9AAF',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  cursor: 'pointer',
                  clipPath: CUT_CHIP,
                  animation: 'pulse 1.4s ease-in-out infinite',
                }}
                title="Nouveau défi reçu">
                ● M'a défié {incomingCount > 1 ? `(${incomingCount})` : ''}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div
              className="animate-spin"
              style={{
                display: 'inline-block',
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: '3px solid rgba(245,197,24,.3)',
                borderTopColor: '#F5C518',
              }}
            />
          </div>
        ) : shown.length === 0 ? (
          <div
            style={{
              marginTop: 40,
              padding: '60px 20px',
              textAlign: 'center',
              border: '1px dashed #3A2E1C',
              color: '#A99C86',
            }}>
            <p style={{ fontSize: 16, margin: 0 }}>
              {tab === 'pending' && "Aucun défi en attente. Visite le profil d'un duelliste pour lancer un défi."}
              {tab === 'active' && 'Aucun duel en cours.'}
              {tab === 'finished' && 'Aucun duel terminé.'}
            </p>
          </div>
        ) : (
          <div
            style={{
              marginTop: 30,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 20,
            }}
            className="max-md:!grid-cols-1">
            {shown.map(renderCard)}
          </div>
        )}
      </div>

      {/* Modal Accept — pattern ChallengeModal */}
      {acceptFor && (
        <div
          onClick={() => setAcceptFor(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(11,9,6,.82)',
            backdropFilter: 'blur(6px)',
            display: 'grid',
            placeItems: 'center',
            padding: 20,
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 480,
              background: 'linear-gradient(160deg,#1A1510,#0D0A06)',
              border: '1px solid #F5C518',
              padding: '32px 30px 26px',
              clipPath: CUT_PANEL,
              boxShadow: '0 30px 60px rgba(0,0,0,.7), 0 0 40px rgba(245,197,24,.18)',
            }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(ellipse 60% 40% at 50% 100%,rgba(168,85,247,.22),transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: 'italic',
                  fontSize: 11,
                  letterSpacing: '0.32em',
                  color: '#F5C518',
                  textTransform: 'uppercase',
                }}>
                — Réponse au défi —
              </div>
              <h2
                style={{
                  margin: '8px 0 0',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 24,
                  fontWeight: 900,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                  color: '#F5EFE0',
                }}>
                Accepter le défi
              </h2>
              <p style={{ margin: '10px 0 0', fontSize: 14, color: '#A99C86' }}>
                Contre{' '}
                <span style={{ color: '#A855F7', fontWeight: 700 }}>
                  @{acceptFor.challenger?.username}
                </span>{' '}
                — choisis ton grimoire
              </p>

              <div style={{ marginTop: 22 }}>
                <label
                  style={{
                    display: 'block',
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 10,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: '#A99C86',
                    marginBottom: 8,
                  }}>
                  Ton deck
                </label>
                {decksLoading ? (
                  <div
                    style={{
                      height: 44,
                      border: '1px dashed #3A2E1C',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#A99C86',
                      fontSize: 13,
                    }}>
                    Chargement…
                  </div>
                ) : decks.length === 0 ? (
                  <div
                    style={{
                      padding: '14px 16px',
                      border: '1px solid #FF4D6D',
                      background: 'rgba(255,77,109,.08)',
                      color: '#FF9AAF',
                      fontSize: 13,
                    }}>
                    Tu n'as aucun deck. Crée-en un pour accepter le défi.
                  </div>
                ) : (
                  <div ref={deckRef} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setAcceptDeckOpen((o) => !o)}
                      style={{
                        width: '100%',
                        padding: '12px 32px 12px 16px',
                        border: '1px solid #F5C518',
                        background: 'linear-gradient(135deg,rgba(245,197,24,.18),rgba(168,85,247,.1))',
                        color: '#F5EFE0',
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: 12,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        cursor: 'pointer',
                        clipPath: CUT_SM,
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}>
                      <span style={{ flex: 1 }}>{acceptSelectedDeck?.name || 'Choisir un deck'}</span>
                      <span
                        style={{
                          fontSize: 9,
                          transform: acceptDeckOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform .15s',
                          color: '#F5C518',
                        }}>
                        ▼
                      </span>
                    </button>
                    {acceptDeckOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 6px)',
                          left: 0,
                          right: 0,
                          maxHeight: 260,
                          overflowY: 'auto',
                          background: 'linear-gradient(160deg,#1A1510,#0D0A06)',
                          border: '1px solid #3A2E1C',
                          boxShadow: '0 22px 40px rgba(0,0,0,.7)',
                          clipPath:
                            'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))',
                          zIndex: 60,
                          padding: '6px 0',
                        }}>
                        {decks.map((dk) => {
                          const active = dk.id === acceptDeckId;
                          const main = dk.main_deck?.reduce((s, c) => s + c.quantity, 0) || (dk as any).main_deck_count || 0;
                          const extra = dk.extra_deck?.reduce((s, c) => s + c.quantity, 0) || (dk as any).extra_deck_count || 0;
                          return (
                            <button
                              key={dk.id}
                              type="button"
                              onClick={() => {
                                setAcceptDeckId(dk.id);
                                setAcceptDeckOpen(false);
                              }}
                              style={{
                                width: '100%',
                                padding: '11px 18px',
                                border: 0,
                                background: active ? 'rgba(245,197,24,.12)' : 'transparent',
                                borderLeft: `3px solid ${active ? '#F5C518' : 'transparent'}`,
                                color: active ? '#F5C518' : '#F5EFE0',
                                fontFamily: "'Orbitron', sans-serif",
                                fontSize: 11,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 10,
                                fontWeight: active ? 700 : 500,
                              }}>
                              <span>{dk.name}</span>
                              <span style={{ fontSize: 10, color: active ? '#F5C518' : '#A99C86' }}>
                                {main}·{extra}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setAcceptFor(null)}
                  disabled={acceptSubmitting}
                  style={{
                    height: 44,
                    padding: '0 20px',
                    background: 'transparent',
                    border: '1px solid #3A2E1C',
                    color: '#A99C86',
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    cursor: acceptSubmitting ? 'not-allowed' : 'pointer',
                    clipPath: CUT_SM,
                  }}>
                  Fermer
                </button>
                <button
                  onClick={handleAccept}
                  disabled={acceptSubmitting || decks.length === 0 || !acceptDeckId}
                  style={{
                    height: 46,
                    padding: '0 24px',
                    position: 'relative',
                    isolation: 'isolate',
                    border: 0,
                    background: 'transparent',
                    color: '#0B0906',
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    cursor:
                      acceptSubmitting || decks.length === 0 || !acceptDeckId
                        ? 'not-allowed'
                        : 'pointer',
                    opacity: acceptSubmitting || decks.length === 0 || !acceptDeckId ? 0.5 : 1,
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
                  {acceptSubmitting ? 'Acceptation…' : 'Que le duel commence'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%,100% { box-shadow: 0 0 0 rgba(255,46,136,0); }
          50% { box-shadow: 0 0 16px rgba(255,46,136,.6); }
        }
      `}</style>
    </div>
  );
};

/** Rendu avatar hex commun (photo ou initiales). */
const renderAvatar = (photo: string | undefined, username: string, accent: string) => {
  const initials = (username || '?').slice(0, 2).toUpperCase();
  if (photo) {
    return (
      <img
        src={getImageUrl(photo)}
        alt={username}
        style={{
          width: 68,
          height: 68,
          objectFit: 'cover',
          border: `1px solid ${accent}`,
          clipPath: HEX,
          boxShadow: `0 0 22px ${accent}55`,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: 68,
        height: 68,
        background: `linear-gradient(135deg,${accent},#5A4D2E)`,
        color: '#0B0906',
        display: 'grid',
        placeItems: 'center',
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 20,
        fontWeight: 900,
        border: `1px solid ${accent}`,
        clipPath: HEX,
        boxShadow: `0 0 22px ${accent}44`,
      }}>
      {initials}
    </div>
  );
};

export default Duels;
