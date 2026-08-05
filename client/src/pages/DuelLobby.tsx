import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Deck, Duel } from '../../../shared/types';
import api, { getImageUrl } from '../services/api';
import duelApi from '../services/duelApi';
import AppNavbar from '../components/AppNavbar';

/**
 * `/duel/:id/lobby` — salle d'attente entre l'acceptation et le pile ou face.
 *
 * Chaque joueur voit face à face le duel : avatar, deck actuel, bouton
 * "Changer" (picker de ses propres decks), bouton "Prêt". Quand les deux
 * cliquent Prêt, on part vers `/duel/:id` où le coin flip démarre.
 *
 * Synchronisation temps réel : WebSocket `duel:deck-changed` et
 * `duel:ready-changed` (émis dans les rooms user + duel côté back) + un
 * poll de secours toutes les 3 s (le back reste la source de vérité pour
 * les transitions autoritatives).
 */

const HEX = 'polygon(50% 0,100% 27%,100% 73%,50% 100%,0 73%,0 27%)';
const CUT_SM = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';
const CUT_BTN = 'polygon(0 0,100% 0,100% 100%,95% 100%,95% 90%,85% 90%,85% 100%,8% 100%,0 70%)';
const CUT_TILE = 'polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px))';

export default function DuelLobby() {
  const { id } = useParams<{ id: string }>();
  const duelId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [duel, setDuel] = useState<Duel | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Empêche de re-nav plusieurs fois quand plusieurs events arrivent en rafale.
  const navigatedRef = useRef(false);

  const fetchDuel = useCallback(async () => {
    try {
      const d = await duelApi.get(duelId);
      setDuel(d);
      // Déjà en pile ou face ou plus loin → l'arène s'en charge.
      if (d.phase_pre_game || d.status === 'finished' || d.status === 'cancelled') {
        if (!navigatedRef.current) {
          navigatedRef.current = true;
          navigate(`/duel/${duelId}`, { replace: true });
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Duel injoignable');
    } finally {
      setLoading(false);
    }
  }, [duelId, navigate]);

  const fetchDecks = useCallback(async () => {
    try {
      const res = await api.get('/decks');
      const list: Deck[] = res.data.data || res.data || [];
      setDecks(list);
    } catch {
      setDecks([]);
    }
  }, []);

  useEffect(() => {
    if (!Number.isInteger(duelId)) return;
    fetchDuel();
    fetchDecks();
  }, [duelId, fetchDuel, fetchDecks]);

  // WS + polling de secours
  useEffect(() => {
    if (!Number.isInteger(duelId)) return;
    const off = duelApi.subscribeToLobby(duelId, {
      onDeckChanged: ({ duel: d }) => setDuel(d),
      onReadyChanged: ({ duel: d, bothReady }) => {
        setDuel(d);
        if (bothReady && !navigatedRef.current) {
          navigatedRef.current = true;
          toast.success('Les deux joueurs sont prêts — pile ou face !', { duration: 2500 });
          setTimeout(() => navigate(`/duel/${duelId}`, { replace: true }), 400);
        }
      },
    });
    const iv = window.setInterval(fetchDuel, 3000);
    return () => {
      off();
      window.clearInterval(iv);
    };
  }, [duelId, fetchDuel, navigate]);

  const meIsChallenger = duel && user ? duel.challenger_id === user.id : false;
  const meDeckId = duel ? (meIsChallenger ? duel.challenger_deck_id : duel.opponent_deck_id) : null;
  const foeDeckId = duel ? (meIsChallenger ? duel.opponent_deck_id : duel.challenger_deck_id) : null;
  const meReady = duel ? (meIsChallenger ? duel.challenger_ready : duel.opponent_ready) : false;
  const foeReady = duel ? (meIsChallenger ? duel.opponent_ready : duel.challenger_ready) : false;
  const meUser = duel ? (meIsChallenger ? duel.challenger : duel.opponent) : null;
  const foeUser = duel ? (meIsChallenger ? duel.opponent : duel.challenger) : null;

  const meDeck = useMemo(() => decks.find((d) => d.id === meDeckId) ?? null, [decks, meDeckId]);
  const bothReady = Boolean(meReady && foeReady);
  const canReady = !meReady && !!meDeckId && !bothReady;

  const handleChangeDeck = async (deckId: number) => {
    if (!duel || busy) return;
    setBusy(true);
    try {
      const updated = await duelApi.changeDeck(duel.id, deckId);
      setDuel(updated);
      setPickerOpen(false);
      toast.success('Deck sélectionné');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Impossible de changer de deck');
    } finally {
      setBusy(false);
    }
  };

  const handleReady = async () => {
    if (!duel || busy) return;
    setBusy(true);
    try {
      const res = await duelApi.setReady(duel.id);
      setDuel(res.duel);
      if (res.bothReady && !navigatedRef.current) {
        navigatedRef.current = true;
        toast.success('Prêt ! Direction le pile ou face', { duration: 2000 });
        setTimeout(() => navigate(`/duel/${duel.id}`, { replace: true }), 400);
      } else {
        toast.success("Tu es prêt — on attend l'adversaire");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Impossible de vous déclarer prêt');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0906' }}>
        <AppNavbar />
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
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
      </div>
    );
  }

  if (!duel) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0906' }}>
        <AppNavbar />
        <div style={{ textAlign: 'center', padding: 60, color: '#A99C86' }}>
          Duel introuvable.
        </div>
      </div>
    );
  }

  const renderAvatar = (photo: string | undefined, username: string, accent: string) => {
    const initials = (username || '?').slice(0, 2).toUpperCase();
    if (photo) {
      return (
        <img
          src={getImageUrl(photo)}
          alt={username}
          style={{
            width: 96,
            height: 96,
            objectFit: 'cover',
            border: `1px solid ${accent}`,
            clipPath: HEX,
            boxShadow: `0 0 24px ${accent}55`,
          }}
        />
      );
    }
    return (
      <div
        style={{
          width: 96,
          height: 96,
          background: `linear-gradient(135deg,${accent},#5A4D2E)`,
          color: '#0B0906',
          display: 'grid',
          placeItems: 'center',
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 28,
          fontWeight: 900,
          border: `1px solid ${accent}`,
          clipPath: HEX,
          boxShadow: `0 0 24px ${accent}55`,
        }}>
        {initials}
      </div>
    );
  };

  const renderSide = (
    ready: boolean,
    accent: string,
    username: string,
    photo: string | undefined,
    deckLabel: string,
    isMe: boolean
  ) => (
    <div
      style={{
        flex: 1,
        minWidth: 240,
        padding: 22,
        background: 'linear-gradient(160deg,#1A1510,#0F0C07)',
        border: `1px solid ${ready ? '#4ADE80' : accent}`,
        clipPath: CUT_TILE,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        position: 'relative',
        transition: 'border-color 220ms',
      }}>
      {/* Badge "Prêt" */}
      {ready && (
        <span
          style={{
            position: 'absolute',
            top: 12,
            right: 16,
            padding: '4px 10px',
            background: 'rgba(74,222,128,.16)',
            border: '1px solid #4ADE80',
            color: '#4ADE80',
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 9,
            letterSpacing: '0.18em',
            fontWeight: 700,
            textTransform: 'uppercase',
          }}>
          ● Prêt
        </span>
      )}

      {renderAvatar(photo, username, accent)}

      <div
        style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 15,
          fontWeight: 900,
          letterSpacing: '0.06em',
          color: '#F5EFE0',
          textTransform: 'uppercase',
        }}>
        @{username}
      </div>

      <div
        style={{
          padding: '10px 14px',
          width: '100%',
          maxWidth: 260,
          background: '#0B0906',
          border: '1px solid #3A2E1C',
          textAlign: 'center',
        }}>
        <div
          style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 9,
            letterSpacing: '0.2em',
            color: '#A99C86',
            textTransform: 'uppercase',
          }}>
          Deck
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: 15,
            color: deckLabel === '—' ? '#6B5A3E' : '#F5EFE0',
            fontWeight: 700,
            letterSpacing: '0.02em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
          {deckLabel}
        </div>
      </div>

      {isMe && (
        <button
          onClick={() => setPickerOpen(true)}
          disabled={meReady || busy}
          style={{
            height: 34,
            padding: '0 16px',
            background: 'transparent',
            border: '1px solid #F5C518',
            color: '#F5C518',
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 10,
            letterSpacing: '0.14em',
            fontWeight: 700,
            textTransform: 'uppercase',
            cursor: meReady || busy ? 'not-allowed' : 'pointer',
            opacity: meReady || busy ? 0.4 : 1,
            clipPath: CUT_SM,
          }}>
          {meReady ? 'Deck verrouillé' : 'Changer de deck'}
        </button>
      )}
    </div>
  );

  const foeDeckLabel = foeDeckId ? 'Sélectionné' : 'Choix en cours…';
  const meDeckLabel = meDeck?.name ?? (meDeckId ? `Deck #${meDeckId}` : '—');

  return (
    <div style={{ minHeight: '100vh', background: '#0B0906', position: 'relative' }}>
      <AppNavbar />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '36px 20px 60px' }}>
        {/* Header */}
        <div
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: 'italic',
            fontSize: 12,
            letterSpacing: '0.32em',
            color: '#F5C518',
            textTransform: 'uppercase',
          }}>
          — Salle d'attente —
        </div>
        <h1
          style={{
            margin: '10px 0 4px',
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 'clamp(30px, 4vw, 46px)',
            fontWeight: 900,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            color: '#F5EFE0',
          }}>
          Avant le pile ou face
        </h1>
        <p style={{ margin: '6px 0 26px', color: '#A99C86', fontSize: 14 }}>
          Vérifiez votre deck, changez-le si besoin, puis cliquez « Prêt ». Le pile ou face
          démarre dès que les deux joueurs ont confirmé.
        </p>

        {/* Deux camps face à face */}
        <div
          style={{
            display: 'flex',
            gap: 20,
            alignItems: 'stretch',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
          {renderSide(
            !!meReady,
            '#F5C518',
            meUser?.username || 'moi',
            meUser?.profile_picture,
            meDeckLabel,
            true
          )}

          {/* VS */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 60,
            }}>
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: 'italic',
                fontSize: 36,
                fontWeight: 700,
                color: '#F5C518',
                textShadow: '0 0 14px rgba(245,197,24,.5)',
              }}>
              VS
            </span>
          </div>

          {renderSide(
            !!foeReady,
            '#A855F7',
            foeUser?.username || '?',
            foeUser?.profile_picture,
            foeDeckLabel,
            false
          )}
        </div>

        {/* Bouton Prêt central */}
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <button
            onClick={handleReady}
            disabled={!canReady || busy}
            style={{
              height: 56,
              padding: '0 44px',
              position: 'relative',
              isolation: 'isolate',
              border: 0,
              background: 'transparent',
              color: '#0B0906',
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              cursor: !canReady || busy ? 'not-allowed' : 'pointer',
              opacity: !canReady || busy ? 0.45 : 1,
            }}>
            <span
              style={{
                position: 'absolute',
                inset: 0,
                background: '#A855F7',
                transform: 'translate(6px,0)',
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
            {meReady
              ? foeReady
                ? 'Lancement…'
                : "En attente de l'adversaire"
              : 'Je suis prêt'}
          </button>
          <div
            style={{
              marginTop: 14,
              fontSize: 12,
              color: '#6B5A3E',
              fontFamily: "'Rajdhani', sans-serif",
              letterSpacing: '0.05em',
            }}>
            {meReady && foeReady && "Les deux joueurs sont prêts — pile ou face dans un instant."}
            {meReady && !foeReady && "Tu es prêt. L'adversaire choisit encore son deck."}
            {!meReady && foeReady && "L'adversaire est prêt. À toi de confirmer."}
            {!meReady && !foeReady && 'Aucun joueur n\'est encore prêt.'}
          </div>
        </div>
      </div>

      {/* Picker de deck */}
      {pickerOpen && (
        <div
          onClick={() => !busy && setPickerOpen(false)}
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
              width: '100%',
              maxWidth: 460,
              background: 'linear-gradient(160deg,#1A1510,#0D0A06)',
              border: '1px solid #F5C518',
              padding: 24,
              clipPath: CUT_TILE,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
            }}>
            <div
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#F5C518',
                marginBottom: 14,
              }}>
              Choisis ton deck
            </div>
            {decks.length === 0 ? (
              <div style={{ color: '#A99C86', fontStyle: 'italic', fontSize: 13 }}>
                Aucun deck disponible. Crée-en un pour changer.
              </div>
            ) : (
              <div style={{ overflowY: 'auto', display: 'grid', gap: 6 }}>
                {decks.map((d) => {
                  const active = d.id === meDeckId;
                  const main = d.main_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
                  const extra = d.extra_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
                  return (
                    <button
                      key={d.id}
                      onClick={() => handleChangeDeck(d.id)}
                      disabled={busy || active}
                      style={{
                        padding: '12px 16px',
                        border: `1px solid ${active ? '#F5C518' : '#3A2E1C'}`,
                        background: active ? 'rgba(245,197,24,.12)' : '#0B0906',
                        color: active ? '#F5C518' : '#F5EFE0',
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: 11,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        textAlign: 'left',
                        cursor: busy || active ? 'default' : 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        fontWeight: active ? 700 : 500,
                      }}>
                      <span
                        style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                        {d.name}
                      </span>
                      <span style={{ fontSize: 10, color: active ? '#F5C518' : '#A99C86' }}>
                        {main}·{extra}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ marginTop: 14, textAlign: 'right' }}>
              <button
                onClick={() => setPickerOpen(false)}
                disabled={busy}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid #3A2E1C',
                  color: '#A99C86',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
