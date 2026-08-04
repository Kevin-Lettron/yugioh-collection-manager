import { useState, useEffect, useRef, useMemo, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  BoardCard,
  DeckCard,
  Duel,
  DuelChatMessage,
  DuelPhase,
  PlayerBoardState,
} from '../../../shared/types';
import duelApi from '../services/duelApi';
import { getImageUrl } from '../services/api';
import AppBackground from '../components/decor/AppBackground';

const CUT_BTN = 'polygon(0 0,100% 0,100% 100%,95% 100%,95% 90%,85% 90%,85% 100%,8% 100%,0 70%)';
const CUT_SM = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';
const CUT_CHIP = 'polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)';
const CUT_ARENA = 'polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,22px 100%,0 calc(100% - 22px))';
const CUT_JAUGE = 'polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))';
const HEX = 'polygon(50% 0,100% 27%,100% 73%,50% 100%,0 73%,0 27%)';

const PHASES: DuelPhase[] = ['draw', 'main1', 'battle', 'main2', 'end'];
const PHASE_LABELS: Record<DuelPhase, string> = {
  draw: 'Pioche',
  main1: 'Main 1',
  battle: 'Combat',
  main2: 'Main 2',
  end: 'Fin',
};

type ZoneKind = 'monster' | 'spelltrap' | 'field';

/** Détermine la zone où poser une carte selon son type. */
const zoneKindOf = (dc: DeckCard | null | undefined): ZoneKind | null => {
  const t = (dc?.card?.type || '').toLowerCase();
  if (!t) return null;
  if (t.includes('field') || (t.includes('spell') && (dc?.card as any)?.race?.toLowerCase?.() === 'field')) return 'field';
  if (t.includes('monster')) return 'monster';
  if (t.includes('spell') || t.includes('trap')) return 'spelltrap';
  return null;
};

/**
 * DuelRoom — arène 2 joueurs avec état real-time via WebSocket.
 * Structure : plateau adverse (haut, retourné visuellement) / bande phase / mon plateau (bas).
 * Sidebar droite : chat + historique. Fetch initial + subscribeToDuel(id) pour patch live.
 * Layout immersif : pas de navbar globale, bouton Retour + Abandonner en top-bar.
 */
const DuelRoom = () => {
  const { id } = useParams<{ id: string }>();
  const duelId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [duel, setDuel] = useState<Duel | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHandIdx, setSelectedHandIdx] = useState<number | null>(null);
  const [nextFaceDown, setNextFaceDown] = useState(false);
  const [attackerSlot, setAttackerSlot] = useState<number | null>(null);
  const [chatText, setChatText] = useState('');
  const [showGraveyard, setShowGraveyard] = useState<'me' | 'foe' | null>(null);
  const [busy, setBusy] = useState(false);
  const [surrenderConfirm, setSurrenderConfirm] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [actionLog, setActionLog] = useState<Array<{ actorId: number; type: string; at: number }>>([]);
  const [finishOverlay, setFinishOverlay] = useState<{ winnerId: number } | null>(null);

  // Fetch initial + subscription temps réel
  useEffect(() => {
    if (!duelId) return;
    let alive = true;
    setLoading(true);
    duelApi
      .get(duelId)
      .then((d) => {
        if (alive) setDuel(d);
      })
      .catch(() => {
        toast.error('Duel introuvable');
        navigate('/duels');
      })
      .finally(() => alive && setLoading(false));

    const off = duelApi.subscribeToDuel(duelId, {
      onAction: ({ duel: d, action, actorId }) => {
        setDuel(d);
        setActionLog((prev) => [
          ...prev,
          { actorId, type: action.type, at: Date.now() },
        ].slice(-40));
      },
      onAccepted: ({ duel: d }) => setDuel(d),
      onFinished: ({ duel: d, winnerId }) => {
        setDuel(d);
        setFinishOverlay({ winnerId });
      },
    });

    return () => {
      alive = false;
      off();
    };
  }, [duelId, navigate]);

  useEffect(() => {
    // Scroll auto en bas du chat
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [duel?.chat_log?.length, actionLog.length]);

  // Détecte fin du duel via status
  useEffect(() => {
    if (duel?.status === 'finished' && !finishOverlay && duel.winner_id != null) {
      setFinishOverlay({ winnerId: duel.winner_id });
    }
  }, [duel?.status, duel?.winner_id, finishOverlay]);

  const meSide: 'challenger' | 'opponent' | null = useMemo(() => {
    if (!duel || !user) return null;
    if (duel.challenger_id === user.id) return 'challenger';
    if (duel.opponent_id === user.id) return 'opponent';
    return null;
  }, [duel, user]);

  const meState: PlayerBoardState | null = duel
    ? meSide === 'challenger'
      ? duel.challenger_state ?? null
      : meSide === 'opponent'
      ? duel.opponent_state ?? null
      : null
    : null;
  const foeState: PlayerBoardState | null = duel
    ? meSide === 'challenger'
      ? duel.opponent_state ?? null
      : meSide === 'opponent'
      ? duel.challenger_state ?? null
      : null
    : null;

  const meLp = duel
    ? meSide === 'challenger'
      ? duel.challenger_lp
      : duel.opponent_lp
    : 0;
  const foeLp = duel
    ? meSide === 'challenger'
      ? duel.opponent_lp
      : duel.challenger_lp
    : 0;

  const meUser = duel ? (meSide === 'challenger' ? duel.challenger : duel.opponent) : null;
  const foeUser = duel ? (meSide === 'challenger' ? duel.opponent : duel.challenger) : null;

  const isMyTurn = duel?.current_turn_player_id === user?.id;
  const canAct = duel?.status === 'active' && !!meSide;

  // ─── Actions ────────────────────────────────────────────────────────────
  const runAction = async (type: string, payload: any) => {
    if (!duel) return;
    setBusy(true);
    try {
      const updated = await duelApi.performAction(duel.id, { type: type as any, payload });
      setDuel(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handlePlace = (kind: ZoneKind, slot: number) => {
    if (selectedHandIdx === null || !meState) return;
    const dc = meState.hand[selectedHandIdx];
    if (!dc) return;
    const wanted = zoneKindOf(dc);
    if (wanted !== kind) {
      toast.error(`« ${dc.card?.name} » ne peut pas aller sur cette zone`);
      return;
    }
    const payload: any = {
      fromHandIndex: selectedHandIdx,
      zone: kind,
      faceDown: nextFaceDown,
    };
    if (kind !== 'field') payload.slotIndex = slot;
    setSelectedHandIdx(null);
    setNextFaceDown(false);
    runAction('place', payload);
  };

  const handleFlip = (zone: ZoneKind, slot: number, bc: BoardCard | null) => {
    if (!bc) return;
    runAction('flip', { zone, slotIndex: zone === 'field' ? undefined : slot });
  };

  const handleGraveyard = (zone: 'monster' | 'spelltrap' | 'field' | 'hand', slot?: number) => {
    runAction('sendToGraveyard', { zone, slotIndex: slot });
  };

  const handleAttack = (targetSlot: number | null) => {
    if (attackerSlot === null) return;
    const payload = { attackerSlot, targetSlot };
    setAttackerSlot(null);
    runAction('attack', payload);
  };

  const handlePhase = (phase: DuelPhase) => {
    if (!duel || !duel.current_phase) return;
    const currentIdx = PHASES.indexOf(duel.current_phase);
    const targetIdx = PHASES.indexOf(phase);
    if (targetIdx <= currentIdx) {
      toast.error('Tu ne peux qu\'avancer les phases');
      return;
    }
    // Avance phase par phase jusqu'à la cible
    (async () => {
      let cur = currentIdx;
      while (cur < targetIdx) {
        await runAction('advance_phase', {});
        cur++;
      }
    })();
  };

  const handleEndTurn = () => runAction('end_turn', {});

  const handleDraw = () => runAction('draw', { count: 1 });

  const handleSurrender = () => {
    if (!surrenderConfirm) {
      setSurrenderConfirm(true);
      window.setTimeout(() => setSurrenderConfirm(false), 3000);
      return;
    }
    runAction('surrender', {});
  };

  const handleChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    const msg = chatText.trim();
    if (!msg) return;
    setChatText('');
    runAction('chat', { message: msg });
  };

  // ─── Rendu ──────────────────────────────────────────────────────────────
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

  if (!duel || !meSide) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0B0906' }}>
        <div style={{ textAlign: 'center', color: '#A99C86' }}>
          <h2 style={{ fontFamily: "'Orbitron', sans-serif", color: '#F5EFE0', fontSize: 20 }}>
            Duel introuvable
          </h2>
          <button
            onClick={() => navigate('/duels')}
            style={{
              marginTop: 12,
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid #F5C518',
              color: '#F5C518',
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 11,
              letterSpacing: '0.12em',
              cursor: 'pointer',
              clipPath: CUT_SM,
            }}>
            Retour aux duels
          </button>
        </div>
      </div>
    );
  }

  // Duel pending — écran d'attente
  if (duel.status === 'pending') {
    return (
      <div style={{ minHeight: '100vh', position: 'relative', background: '#0B0906' }}>
        <AppBackground />
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: 20,
          }}>
          <div
            style={{
              padding: '40px 40px 34px',
              background: 'linear-gradient(160deg,#1A1510,#0D0A06)',
              border: '1px solid #F5C518',
              clipPath: CUT_ARENA,
              textAlign: 'center',
              maxWidth: 480,
            }}>
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: 'italic',
                fontSize: 12,
                letterSpacing: '0.32em',
                color: '#F5C518',
                textTransform: 'uppercase',
              }}>
              — Sceau en attente —
            </div>
            <h1
              style={{
                margin: '10px 0 0',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 28,
                fontWeight: 900,
                color: '#F5EFE0',
                textTransform: 'uppercase',
              }}>
              Le duel n'a pas commencé
            </h1>
            <p style={{ marginTop: 14, color: '#A99C86' }}>
              L'adversaire doit accepter le défi pour que la partie s'ouvre.
            </p>
            <button
              onClick={() => navigate('/duels')}
              style={{
                marginTop: 20,
                padding: '12px 22px',
                background: 'transparent',
                border: '1px solid #F5C518',
                color: '#F5C518',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 700,
                cursor: 'pointer',
                clipPath: CUT_SM,
              }}>
              Retour aux duels
            </button>
          </div>
        </div>
      </div>
    );
  }

  const winnerIsMe = finishOverlay?.winnerId === user?.id;

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: '#0B0906', color: '#F5EFE0' }}>
      <AppBackground />
      <TopBar
        duel={duel}
        meUser={meUser}
        foeUser={foeUser}
        onBack={() => navigate('/duels')}
        onSurrender={handleSurrender}
        surrenderConfirm={surrenderConfirm}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '16px 20px 24px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 20,
          maxWidth: 1600,
          margin: '0 auto',
          alignItems: 'start',
        }}
        className="max-lg:!grid-cols-1">
        {/* Arène centrale */}
        <div
          style={{
            padding: '24px 24px 20px',
            background: 'linear-gradient(180deg,#14100A,#0B0906)',
            border: '1px solid #3A2E1C',
            clipPath: CUT_ARENA,
            position: 'relative',
            overflow: 'hidden',
          }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse 60% 50% at 50% 50%,rgba(168,85,247,.14),transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(rgba(245,197,24,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(245,197,24,.05) 1px,transparent 1px)',
              backgroundSize: '30px 30px',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Plateau adverse — retourné visuellement (rotate 180) */}
            <PlayerBoard
              side="foe"
              user={foeUser}
              lp={foeLp}
              state={foeState}
              isTurn={!isMyTurn && duel.status === 'active'}
              interactive={canAct && attackerSlot !== null}
              attackTargetMode={attackerSlot !== null}
              onZoneClick={(zone, slot) => {
                if (attackerSlot === null) return;
                if (zone !== 'monster') return;
                handleAttack(slot);
              }}
              onDirectAttack={() => handleAttack(null)}
              onGraveyardClick={() => setShowGraveyard('foe')}
            />

            {/* Bande centrale phase + info tour */}
            <PhaseBanner duel={duel} isMyTurn={isMyTurn} />

            {/* Mon plateau */}
            <PlayerBoard
              side="me"
              user={meUser}
              lp={meLp}
              state={meState}
              isTurn={isMyTurn && duel.status === 'active'}
              interactive={canAct}
              selectedHandIdx={selectedHandIdx}
              attackerSlot={attackerSlot}
              onZoneClick={(zone, slot, bc) => {
                if (!canAct) return;
                if (bc) {
                  if (duel.current_phase === 'battle' && zone === 'monster' && !bc.faceDown && !bc.defenseMode && isMyTurn) {
                    setAttackerSlot(attackerSlot === slot ? null : slot);
                    return;
                  }
                  if (isMyTurn) handleFlip(zone, slot, bc);
                } else if (selectedHandIdx !== null && isMyTurn) {
                  handlePlace(zone, slot);
                }
              }}
              onGraveyardClick={() => setShowGraveyard('me')}
              onZoneClear={(zone, slot) =>
                isMyTurn && handleGraveyard(zone, zone === 'field' ? undefined : slot)
              }
            />

            {/* Message si sélection en cours */}
            {selectedHandIdx !== null && meState?.hand[selectedHandIdx] && (
              <div
                style={{
                  padding: '8px 14px',
                  background: 'rgba(245,197,24,.08)',
                  border: '1px solid rgba(245,197,24,.3)',
                  color: '#F5C518',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}>
                <span>« {meState.hand[selectedHandIdx]?.card?.name} » — clique une zone</span>
                <button
                  onClick={() => setNextFaceDown((v) => !v)}
                  style={{
                    padding: '4px 12px',
                    border: `1px solid ${nextFaceDown ? '#F5C518' : '#3A2E1C'}`,
                    background: nextFaceDown ? 'rgba(245,197,24,.15)' : 'transparent',
                    color: nextFaceDown ? '#F5C518' : '#A99C86',
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}>
                  {nextFaceDown ? '✓ Face verso' : 'Face verso'}
                </button>
              </div>
            )}

            {attackerSlot !== null && (
              <div
                style={{
                  padding: '8px 14px',
                  background: 'rgba(255,46,136,.1)',
                  border: '1px solid #FF2E88',
                  color: '#FF9AAF',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  gap: 12,
                  justifyContent: 'center',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}>
                <span>Choisis une cible adverse (monstre ou attaque directe)</span>
                <button
                  onClick={() => setAttackerSlot(null)}
                  style={{
                    padding: '4px 12px',
                    border: '1px solid #FF2E88',
                    background: 'transparent',
                    color: '#FF9AAF',
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}>
                  Annuler
                </button>
              </div>
            )}

            {/* Ma main */}
            <HandBar
              hand={meState?.hand || []}
              selectedIdx={selectedHandIdx}
              onSelect={(i) => setSelectedHandIdx(selectedHandIdx === i ? null : i)}
              onDiscard={(i) => isMyTurn && runAction('discard', { fromHandIndex: i })}
              interactive={canAct && isMyTurn}
            />

            {/* Barre d'actions phase / draw / end turn */}
            <ActionBar
              duel={duel}
              isMyTurn={isMyTurn}
              busy={busy}
              onPhase={handlePhase}
              onDraw={handleDraw}
              onEndTurn={handleEndTurn}
            />
          </div>
        </div>

        {/* Sidebar chat + log */}
        <div
          style={{
            position: 'sticky',
            top: 80,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            maxHeight: 'calc(100vh - 100px)',
          }}
          className="max-lg:!static max-lg:!max-h-none">
          <ChatPanel
            duel={duel}
            actionLog={actionLog}
            chatText={chatText}
            setChatText={setChatText}
            onSubmit={handleChatSubmit}
            scrollRef={chatScrollRef}
            meId={user?.id}
          />
        </div>
      </div>

      {/* Drawer cimetière */}
      {showGraveyard && (
        <GraveyardDrawer
          cards={
            showGraveyard === 'me' ? meState?.graveyard || [] : foeState?.graveyard || []
          }
          banished={
            showGraveyard === 'me' ? meState?.banished || [] : foeState?.banished || []
          }
          label={showGraveyard === 'me' ? 'Mon cimetière' : `Cimetière @${foeUser?.username}`}
          onClose={() => setShowGraveyard(null)}
        />
      )}

      {/* Overlay fin */}
      {finishOverlay && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(11,9,6,.9)',
            backdropFilter: 'blur(10px)',
            display: 'grid',
            placeItems: 'center',
            padding: 20,
          }}>
          <div
            style={{
              padding: '60px 60px 48px',
              background: 'linear-gradient(160deg,#1A1510,#0D0A06)',
              border: `2px solid ${winnerIsMe ? '#F5C518' : '#FF2E88'}`,
              clipPath: CUT_ARENA,
              textAlign: 'center',
              boxShadow: winnerIsMe
                ? '0 0 80px rgba(245,197,24,.5)'
                : '0 0 80px rgba(255,46,136,.4)',
            }}>
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: 'italic',
                fontSize: 14,
                letterSpacing: '0.32em',
                color: winnerIsMe ? '#F5C518' : '#FF2E88',
                textTransform: 'uppercase',
              }}>
              — Verdict du sanctuaire —
            </div>
            <h1
              style={{
                margin: '16px 0 0',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 64,
                fontWeight: 900,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: winnerIsMe ? '#F5C518' : '#FF2E88',
                textShadow: winnerIsMe
                  ? '0 0 30px rgba(245,197,24,.6)'
                  : '0 0 30px rgba(255,46,136,.55)',
              }}>
              {winnerIsMe ? 'Victoire' : 'Défaite'}
            </h1>
            <p style={{ margin: '18px 0 0', color: '#A99C86', fontSize: 15 }}>
              LP finaux — Toi{' '}
              <strong style={{ color: '#F5EFE0' }}>{meLp}</strong> · @{foeUser?.username}{' '}
              <strong style={{ color: '#F5EFE0' }}>{foeLp}</strong>
            </p>
            <button
              onClick={() => navigate('/duels')}
              style={{
                marginTop: 26,
                height: 52,
                padding: '0 32px',
                position: 'relative',
                isolation: 'isolate',
                border: 0,
                background: 'transparent',
                color: '#0B0906',
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.16em',
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
              Retour aux duels
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sous-composants ─────────────────────────────────────────────────────

const TopBar = ({
  duel,
  meUser,
  foeUser,
  onBack,
  onSurrender,
  surrenderConfirm,
}: {
  duel: Duel;
  meUser: any;
  foeUser: any;
  onBack: () => void;
  onSurrender: () => void;
  surrenderConfirm: boolean;
}) => (
  <div
    style={{
      position: 'sticky',
      top: 0,
      zIndex: 30,
      background: 'linear-gradient(180deg,rgba(11,9,6,.92),rgba(11,9,6,.75))',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid #3A2E1C',
      padding: '12px 22px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
    }}>
    <button
      onClick={onBack}
      style={{
        padding: '8px 14px',
        background: 'transparent',
        border: '1px solid #3A2E1C',
        color: '#A99C86',
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontWeight: 700,
        cursor: 'pointer',
        clipPath: CUT_SM,
      }}>
      ← Retour
    </button>

    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        flexWrap: 'wrap',
      }}>
      <span
        style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#F5EFE0',
        }}>
        @{meUser?.username || 'moi'}
      </span>
      <span
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: 'italic',
          color: '#F5C518',
          fontSize: 18,
          textShadow: '0 0 10px rgba(245,197,24,.4)',
        }}>
        vs
      </span>
      <span
        style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#F5EFE0',
        }}>
        @{foeUser?.username || '?'}
      </span>
      {duel.current_phase && (
        <span
          style={{
            padding: '4px 10px',
            border: '1px solid #A855F7',
            color: '#C084FC',
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 9,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            fontWeight: 700,
            clipPath: CUT_CHIP,
            marginLeft: 6,
          }}>
          {PHASE_LABELS[duel.current_phase]} · Tour {duel.turn_number}
        </span>
      )}
    </div>

    {/* On est ici dans le tapis de jeu libre : aucune règle n'est appliquée.
        Le dire explicitement évite de croire à un moteur défaillant. */}
    <span
      style={{
        padding: '8px 12px',
        border: '1px solid var(--magenta)',
        color: 'var(--magenta)',
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 9,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontWeight: 700,
        marginRight: 10,
      }}
      title="Ce mode n'applique aucune règle : ni phases, ni limites d'invocation, ni effets.">
      Mode libre · sans règles
    </span>
    <a
      href={`/duel/${duel.id}`}
      style={{
        padding: '8px 14px',
        background: 'var(--gold)',
        color: 'var(--on-gold)',
        border: 'none',
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontWeight: 700,
        textDecoration: 'none',
        marginRight: 10,
        clipPath: CUT_SM,
      }}
      title="Jouer avec les règles appliquées par ygopro-core">
      Passer au moteur
    </a>

    <button
      onClick={onSurrender}
      style={{
        padding: '8px 14px',
        background: surrenderConfirm ? 'rgba(255,46,136,.18)' : 'transparent',
        border: '1px solid #FF2E88',
        color: '#FF9AAF',
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontWeight: 700,
        cursor: 'pointer',
        clipPath: CUT_SM,
      }}
      title={surrenderConfirm ? 'Clique à nouveau pour confirmer' : 'Abandonner le duel'}>
      {surrenderConfirm ? 'Confirmer ?' : 'Abandonner'}
    </button>
  </div>
);

const PhaseBanner = ({ duel, isMyTurn }: { duel: Duel; isMyTurn: boolean }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 20,
      padding: '10px 16px',
      background:
        'linear-gradient(90deg,transparent,rgba(168,85,247,.15),transparent)',
      borderTop: '1px solid rgba(168,85,247,.25)',
      borderBottom: '1px solid rgba(168,85,247,.25)',
    }}>
    <span
      style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontStyle: 'italic',
        fontSize: 11,
        letterSpacing: '0.28em',
        color: '#A99C86',
        textTransform: 'uppercase',
      }}>
      — Phase {duel.current_phase ? PHASE_LABELS[duel.current_phase] : '—'} —
    </span>
    <span
      style={{
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 16,
        fontWeight: 900,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: isMyTurn ? '#F5C518' : '#A855F7',
        textShadow: isMyTurn
          ? '0 0 12px rgba(245,197,24,.5)'
          : '0 0 12px rgba(168,85,247,.4)',
      }}>
      {isMyTurn ? 'Ton tour' : 'Tour adverse'}
    </span>
  </div>
);

interface PlayerBoardProps {
  side: 'me' | 'foe';
  user: any;
  lp: number;
  state: PlayerBoardState | null;
  isTurn: boolean;
  interactive: boolean;
  selectedHandIdx?: number | null;
  attackerSlot?: number | null;
  attackTargetMode?: boolean;
  onZoneClick: (zone: ZoneKind, slot: number, bc: BoardCard | null) => void;
  onDirectAttack?: () => void;
  onGraveyardClick?: () => void;
  onZoneClear?: (zone: ZoneKind, slot: number) => void;
}

const PlayerBoard = ({
  side,
  user,
  lp,
  state,
  isTurn,
  interactive,
  attackerSlot,
  attackTargetMode,
  onZoneClick,
  onDirectAttack,
  onGraveyardClick,
  onZoneClear,
}: PlayerBoardProps) => {
  const isFoe = side === 'foe';
  const lpMax = 8000;
  const lpPct = Math.max(0, Math.min(100, (lp / lpMax) * 100));
  const lpColor = lpPct > 50 ? '#F5C518' : lpPct > 25 ? '#F59E0B' : '#FF2E88';
  const hasMonster = state?.monsters.some((m) => m !== null);

  // Rangée monster + spelltrap : pour un plateau miroir, l'ordre visuel
  // reste identique (les 5 slots monster, puis 5 spelltrap sous eux).
  // Pour le "foe" en haut, l'ordre est inversé (spelltrap au-dessus, monsters en bas).
  const monsters = state?.monsters || [null, null, null, null, null];
  const spellTraps = state?.spellTraps || [null, null, null, null, null];
  const field = state?.field ?? null;
  const hand = state?.hand || [];
  const deck = state?.deck || [];
  const graveyard = state?.graveyard || [];

  return (
    <div
      style={{
        padding: '14px 16px',
        background: isFoe
          ? 'linear-gradient(180deg,rgba(255,46,136,.05),transparent)'
          : 'linear-gradient(0deg,rgba(245,197,24,.05),transparent)',
        border: `1px solid ${isTurn ? (isFoe ? '#A855F7' : '#F5C518') : '#3A2E1C'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'border-color 200ms',
      }}>
      {/* Ligne info : avatar + LP + main + deck + cimetière */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 180 }}>
          {user?.profile_picture ? (
            <img
              src={getImageUrl(user.profile_picture)}
              alt={user.username}
              style={{
                width: 44,
                height: 44,
                objectFit: 'cover',
                border: `1px solid ${isFoe ? '#A855F7' : '#F5C518'}`,
                clipPath: HEX,
              }}
            />
          ) : (
            <div
              style={{
                width: 44,
                height: 44,
                display: 'grid',
                placeItems: 'center',
                background: `linear-gradient(135deg,${isFoe ? '#A855F7' : '#F5C518'},#5A4D2E)`,
                color: '#0B0906',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 13,
                fontWeight: 900,
                border: `1px solid ${isFoe ? '#A855F7' : '#F5C518'}`,
                clipPath: HEX,
              }}>
              {(user?.username || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#F5EFE0',
              }}>
              @{user?.username || (isFoe ? 'adversaire' : 'moi')}
            </span>
            {isTurn && (
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: 'italic',
                  fontSize: 10,
                  color: isFoe ? '#A855F7' : '#F5C518',
                  letterSpacing: '0.14em',
                }}>
                — à jouer —
              </span>
            )}
          </div>
        </div>

        {/* Jauge LP */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 9,
                letterSpacing: '0.18em',
                color: '#A99C86',
                textTransform: 'uppercase',
              }}>
              Life Points
            </span>
            <span
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 15,
                fontWeight: 900,
                color: lpColor,
                fontVariantNumeric: 'tabular-nums',
                textShadow: `0 0 10px ${lpColor}55`,
              }}>
              {lp}
            </span>
          </div>
          <div
            style={{
              height: 10,
              background: '#0F0C07',
              border: '1px solid #3A2E1C',
              clipPath: CUT_JAUGE,
              overflow: 'hidden',
            }}>
            <div
              style={{
                height: '100%',
                width: `${lpPct}%`,
                background: `linear-gradient(90deg,${lpColor},${lpColor}aa)`,
                boxShadow: `0 0 12px ${lpColor}80`,
                transition: 'width 500ms cubic-bezier(.2,.8,.2,1)',
              }}
            />
          </div>
        </div>

        {/* Deck + main + cim */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <MiniPile label="Deck" count={deck.length} color="#22D3EE" />
          <MiniPile label="Main" count={hand.length} color="#F5C518" facedown={isFoe} />
          <MiniPile
            label="Cim."
            count={graveyard.length}
            color="#FF2E88"
            onClick={onGraveyardClick}
            clickable
          />
        </div>
      </div>

      {/* Zones : ordre visuel — pour foe, spelltrap au-dessus (miroir), pour me monster au-dessus */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        {isFoe ? (
          <>
            <ZoneRow
              zones={spellTraps}
              kind="spelltrap"
              accent="rgba(168,85,247,.55)"
              label="M/P"
              interactive={false}
              onClick={() => {}}
              onClear={undefined}
              flipped={true}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ZoneRow
                zones={monsters}
                kind="monster"
                accent="rgba(245,197,24,.5)"
                label="Monstre"
                interactive={!!attackTargetMode}
                onClick={(slot, bc) => onZoneClick('monster', slot, bc)}
                onClear={undefined}
                flipped={true}
                highlightMode={attackTargetMode ? 'target' : undefined}
              />
              <FieldZone
                bc={field}
                interactive={false}
                onClick={() => {}}
                onClear={undefined}
                flipped={true}
              />
            </div>
            {/* Bouton attaque directe si aucun monstre adverse */}
            {attackTargetMode && !hasMonster && (
              <button
                onClick={onDirectAttack}
                style={{
                  padding: '10px 22px',
                  background: 'linear-gradient(135deg,#FF2E88,#A855F7)',
                  border: 0,
                  color: '#F5EFE0',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  cursor: 'pointer',
                  clipPath: CUT_SM,
                  boxShadow: '0 0 20px rgba(255,46,136,.5)',
                }}>
                ⚔ Attaque directe
              </button>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FieldZone
                bc={field}
                interactive={interactive}
                onClick={(bc) => onZoneClick('field', 0, bc)}
                onClear={
                  onZoneClear ? () => onZoneClear('field', 0) : undefined
                }
              />
              <ZoneRow
                zones={monsters}
                kind="monster"
                accent="rgba(245,197,24,.55)"
                label="Monstre"
                interactive={interactive}
                onClick={(slot, bc) => onZoneClick('monster', slot, bc)}
                onClear={onZoneClear ? (slot) => onZoneClear('monster', slot) : undefined}
                highlightMode={
                  attackerSlot !== null ? 'attacker' : undefined
                }
                highlightSlot={attackerSlot ?? undefined}
              />
            </div>
            <ZoneRow
              zones={spellTraps}
              kind="spelltrap"
              accent="rgba(168,85,247,.55)"
              label="M/P"
              interactive={interactive}
              onClick={(slot, bc) => onZoneClick('spelltrap', slot, bc)}
              onClear={onZoneClear ? (slot) => onZoneClear('spelltrap', slot) : undefined}
            />
          </>
        )}
      </div>
    </div>
  );
};

const MiniPile = ({
  label,
  count,
  color,
  onClick,
  clickable,
  facedown,
}: {
  label: string;
  count: number;
  color: string;
  onClick?: () => void;
  clickable?: boolean;
  facedown?: boolean;
}) => (
  <div
    onClick={clickable ? onClick : undefined}
    title={clickable ? `Voir ${label}` : label}
    style={{
      minWidth: 54,
      padding: '6px 10px',
      background: 'rgba(11,9,6,.6)',
      border: `1px solid ${color}66`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      cursor: clickable ? 'pointer' : 'default',
      transition: 'border-color 160ms, box-shadow 160ms',
    }}
    onMouseEnter={(e) => {
      if (clickable) {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 0 12px ${color}55`;
      }
    }}
    onMouseLeave={(e) => {
      if (clickable) {
        e.currentTarget.style.borderColor = `${color}66`;
        e.currentTarget.style.boxShadow = 'none';
      }
    }}>
    <span
      style={{
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 8,
        letterSpacing: '0.18em',
        color: '#A99C86',
        textTransform: 'uppercase',
      }}>
      {label}
      {facedown && ' 🂠'}
    </span>
    <span
      style={{
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 14,
        fontWeight: 700,
        color,
        fontVariantNumeric: 'tabular-nums',
      }}>
      {count}
    </span>
  </div>
);

const ZoneRow = ({
  zones,
  kind,
  accent,
  label,
  interactive,
  onClick,
  onClear,
  flipped,
  highlightMode,
  highlightSlot,
}: {
  zones: (BoardCard | null)[];
  kind: 'monster' | 'spelltrap';
  accent: string;
  label: string;
  interactive: boolean;
  onClick: (slot: number, bc: BoardCard | null) => void;
  onClear?: (slot: number) => void;
  flipped?: boolean;
  highlightMode?: 'attacker' | 'target';
  highlightSlot?: number;
}) => (
  <div style={{ display: 'flex', gap: 8 }}>
    {zones.map((bc, i) => (
      <ZoneSlot
        key={`${kind}-${i}`}
        bc={bc}
        accent={accent}
        label={label}
        interactive={interactive}
        highlighted={highlightMode === 'attacker' && highlightSlot === i}
        targetable={highlightMode === 'target'}
        onClick={() => interactive && onClick(i, bc)}
        onClear={onClear && bc ? () => onClear(i) : undefined}
        flipped={flipped}
        defenseMode={bc?.defenseMode}
      />
    ))}
  </div>
);

const FieldZone = ({
  bc,
  interactive,
  onClick,
  onClear,
  flipped,
}: {
  bc: BoardCard | null;
  interactive: boolean;
  onClick: (bc: BoardCard | null) => void;
  onClear?: () => void;
  flipped?: boolean;
}) => (
  <ZoneSlot
    bc={bc}
    accent="rgba(34,211,238,.5)"
    label="Terrain"
    interactive={interactive}
    onClick={() => interactive && onClick(bc)}
    onClear={onClear && bc ? onClear : undefined}
    flipped={flipped}
    w={70}
    h={54}
    defenseMode={bc?.defenseMode}
  />
);

const ZoneSlot = ({
  bc,
  accent,
  label,
  interactive,
  highlighted,
  targetable,
  onClick,
  onClear,
  flipped,
  w = 68,
  h = 92,
  defenseMode,
}: {
  bc: BoardCard | null;
  accent: string;
  label: string;
  interactive: boolean;
  highlighted?: boolean;
  targetable?: boolean;
  onClick: () => void;
  onClear?: () => void;
  flipped?: boolean;
  w?: number;
  h?: number;
  defenseMode?: boolean;
}) => {
  const isEmptyTargetable = interactive && !bc && targetable;
  const showTarget = targetable && bc;
  return (
    <div
      onClick={onClick}
      style={{
        width: w,
        height: h,
        position: 'relative',
        cursor: interactive ? 'pointer' : 'default',
        background: bc
          ? 'linear-gradient(150deg,#2A2216,#14100A)'
          : isEmptyTargetable
          ? 'rgba(255,46,136,.06)'
          : 'rgba(255,255,255,.02)',
        border: highlighted
          ? '2px solid #FF2E88'
          : showTarget
          ? '2px dashed #FF2E88'
          : bc
          ? `1px solid ${accent}`
          : `1px dashed ${accent.replace(/,\s*\.[0-9]+\)/, ',.4)')}`,
        boxShadow: highlighted
          ? '0 0 20px rgba(255,46,136,.55)'
          : bc
          ? `0 0 12px -2px ${accent}`
          : 'none',
        transition: 'all 180ms cubic-bezier(.2,.8,.2,1)',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        transform: defenseMode ? 'rotate(-90deg)' : 'none',
      }}
      title={
        bc
          ? `${bc.card.card?.name || '?'}${bc.faceDown ? ' (face verso)' : ''}${defenseMode ? ' — défense' : ''}`
          : label
      }>
      {bc ? (
        bc.faceDown ? (
          <FaceDown flipped={flipped} h={h} />
        ) : bc.card.card?.card_images?.[0]?.image_url_small ? (
          <img
            src={bc.card.card.card_images[0].image_url_small}
            alt={bc.card.card.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: flipped ? 'rotate(180deg)' : 'none',
            }}
          />
        ) : (
          <span style={{ fontSize: 9, color: '#F5EFE0', padding: 4, textAlign: 'center' }}>
            {bc.card.card?.name}
          </span>
        )
      ) : (
        <span
          style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 8,
            letterSpacing: '0.14em',
            color: '#A99C86',
            opacity: 0.55,
            textTransform: 'uppercase',
            transform: flipped ? 'rotate(180deg)' : 'none',
          }}>
          {label}
        </span>
      )}
      {onClear && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          title="Envoyer au cimetière"
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 15,
            height: 15,
            border: '1px solid rgba(255,46,136,.5)',
            background: 'rgba(11,9,6,.85)',
            color: '#FF2E88',
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            padding: 0,
            transform: defenseMode ? 'rotate(90deg)' : 'none',
          }}>
          ×
        </button>
      )}
    </div>
  );
};

const FaceDown = ({ flipped, h }: { flipped?: boolean; h: number }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      background: 'radial-gradient(circle at 50% 40%,#5A4D2E 0%,#2A2216 60%,#14100A 100%)',
      display: 'grid',
      placeItems: 'center',
      position: 'relative',
      overflow: 'hidden',
      transform: flipped ? 'rotate(180deg)' : 'none',
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
          'radial-gradient(circle,#F5C518 0%,#C29A0F 55%,rgba(194,154,15,0) 75%)',
        display: 'grid',
        placeItems: 'center',
        fontFamily: "'Cormorant Garamond', serif",
        fontStyle: 'italic',
        fontSize: h * 0.28,
        fontWeight: 700,
        color: '#0B0906',
        textShadow: '0 1px 2px rgba(0,0,0,.4)',
      }}>
      K
    </div>
  </div>
);

const HandBar = ({
  hand,
  selectedIdx,
  onSelect,
  onDiscard,
  interactive,
}: {
  hand: DeckCard[];
  selectedIdx: number | null;
  onSelect: (i: number) => void;
  onDiscard: (i: number) => void;
  interactive: boolean;
}) => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
      padding: '10px 0 4px',
      borderTop: '1px dashed #3A2E1C',
    }}>
    <div
      style={{
        width: '100%',
        marginBottom: 4,
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#A99C86',
      }}>
      Ma main · {hand.length} cartes
    </div>
    {hand.length === 0 && (
      <div
        style={{
          padding: 20,
          width: '100%',
          textAlign: 'center',
          color: '#6B5A3E',
          fontStyle: 'italic',
          fontSize: 13,
        }}>
        Main vide.
      </div>
    )}
    {hand.map((dc, i) => {
      const isSelected = selectedIdx === i;
      const kind = zoneKindOf(dc);
      const accent =
        kind === 'monster'
          ? '#F5C518'
          : kind === 'field'
          ? '#22D3EE'
          : kind === 'spelltrap'
          ? '#A855F7'
          : '#3A2E1C';
      return (
        <div key={`h-${i}`} style={{ position: 'relative', width: 108, flex: 'none' }}>
          <div
            onClick={() => interactive && onSelect(i)}
            style={{
              aspectRatio: '59 / 86',
              background: 'linear-gradient(135deg,#221B12,#14100A)',
              border: `${isSelected ? 2 : 1}px solid ${isSelected ? accent : '#3A2E1C'}`,
              overflow: 'hidden',
              cursor: interactive ? 'pointer' : 'default',
              transform: isSelected ? 'translateY(-8px)' : 'translateY(0)',
              boxShadow: isSelected
                ? `0 12px 24px rgba(0,0,0,.6), 0 0 22px ${accent}88`
                : '0 6px 14px rgba(0,0,0,.45)',
              transition: 'all 200ms cubic-bezier(.2,.8,.2,1)',
              clipPath: 'polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)',
              opacity: interactive ? 1 : 0.7,
            }}>
            {dc.card?.card_images?.[0]?.image_url_small ? (
              <img
                src={dc.card.card_images[0].image_url_small}
                alt={dc.card.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  height: '100%',
                  color: '#A99C86',
                  fontSize: 10,
                  padding: 6,
                  textAlign: 'center',
                }}>
                {dc.card?.name}
              </div>
            )}
          </div>
          {interactive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDiscard(i);
              }}
              title="Défausser"
              style={{
                marginTop: 4,
                width: '100%',
                padding: '3px 0',
                border: '1px solid rgba(255,46,136,.5)',
                background: 'transparent',
                color: '#FF2E88',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 8,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}>
              Défausser
            </button>
          )}
        </div>
      );
    })}
  </div>
);

const ActionBar = ({
  duel,
  isMyTurn,
  busy,
  onPhase,
  onDraw,
  onEndTurn,
}: {
  duel: Duel;
  isMyTurn: boolean;
  busy: boolean;
  onPhase: (p: DuelPhase) => void;
  onDraw: () => void;
  onEndTurn: () => void;
}) => {
  const canPhase = (p: DuelPhase) =>
    isMyTurn &&
    duel.status === 'active' &&
    duel.current_phase != null &&
    PHASES.indexOf(p) > PHASES.indexOf(duel.current_phase);

  const btn = (label: string, onClick: () => void, enabled: boolean, primary?: boolean) => (
    <button
      key={label}
      onClick={onClick}
      disabled={!enabled || busy}
      style={{
        height: 36,
        padding: '0 14px',
        border: primary ? 0 : `1px solid ${enabled ? '#F5C518' : '#3A2E1C'}`,
        background: primary
          ? 'linear-gradient(135deg,#F5C518,#C29A0F)'
          : enabled
          ? 'rgba(245,197,24,.08)'
          : '#14100A',
        color: primary ? '#0B0906' : enabled ? '#F5C518' : '#6B5A3E',
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontWeight: 700,
        cursor: enabled && !busy ? 'pointer' : 'not-allowed',
        clipPath: CUT_SM,
        opacity: enabled ? 1 : 0.55,
      }}>
      {label}
    </button>
  );

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'center',
        flexWrap: 'wrap',
        padding: '10px 0 4px',
        borderTop: '1px solid #3A2E1C',
      }}>
      {btn('+1 Pioche', onDraw, isMyTurn && duel.status === 'active')}
      {btn('Main 1', () => onPhase('main1'), canPhase('main1'))}
      {btn('Battle', () => onPhase('battle'), canPhase('battle'))}
      {btn('Main 2', () => onPhase('main2'), canPhase('main2'))}
      {btn('End Turn', onEndTurn, isMyTurn && duel.status === 'active', true)}
    </div>
  );
};

const ChatPanel = ({
  duel,
  actionLog,
  chatText,
  setChatText,
  onSubmit,
  scrollRef,
  meId,
}: {
  duel: Duel;
  actionLog: Array<{ actorId: number; type: string; at: number }>;
  chatText: string;
  setChatText: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  meId?: number;
}) => {
  const merged = useMemo(() => {
    const chat = (duel.chat_log || []).map((m: DuelChatMessage) => ({
      kind: 'chat' as const,
      at: new Date(m.at).getTime(),
      m,
    }));
    const acts = actionLog.map((a) => ({ kind: 'action' as const, at: a.at, a }));
    return [...chat, ...acts].sort((x, y) => x.at - y.at);
  }, [duel.chat_log, actionLog]);

  const userLabel = (uid: number) => {
    if (uid === duel.challenger_id) return duel.challenger?.username || 'challenger';
    if (uid === duel.opponent_id) return duel.opponent?.username || 'opponent';
    return 'système';
  };

  return (
    <div
      style={{
        background: 'linear-gradient(160deg,#1A1510,#0D0A06)',
        border: '1px solid #3A2E1C',
        clipPath: CUT_ARENA,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 320,
        maxHeight: '100%',
      }}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #3A2E1C',
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 10,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#F5C518',
        }}>
        Chat & journal
      </div>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxHeight: 420,
        }}>
        {merged.length === 0 && (
          <div style={{ color: '#6B5A3E', fontSize: 12, textAlign: 'center', padding: 20, fontStyle: 'italic' }}>
            Aucun échange pour le moment.
          </div>
        )}
        {merged.map((entry, idx) => {
          if (entry.kind === 'chat') {
            const isMe = entry.m.user_id === meId;
            return (
              <div
                key={`c-${idx}`}
                style={{
                  padding: '6px 10px',
                  background: isMe ? 'rgba(245,197,24,.08)' : 'rgba(168,85,247,.06)',
                  borderLeft: `2px solid ${isMe ? '#F5C518' : '#A855F7'}`,
                  fontSize: 12,
                  color: '#F5EFE0',
                  lineHeight: 1.4,
                }}>
                <div
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 8,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: isMe ? '#F5C518' : '#C084FC',
                    fontWeight: 700,
                    marginBottom: 2,
                  }}>
                  @{userLabel(entry.m.user_id)}
                </div>
                {entry.m.message}
              </div>
            );
          }
          return (
            <div
              key={`a-${idx}`}
              style={{
                padding: '4px 10px',
                fontSize: 10,
                color: '#A99C86',
                fontFamily: "'Orbitron', sans-serif",
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontStyle: 'italic',
                borderLeft: '2px solid #3A2E1C',
              }}>
              → @{userLabel(entry.a.actorId)} · {entry.a.type}
            </div>
          );
        })}
      </div>
      <form
        onSubmit={onSubmit}
        style={{
          display: 'flex',
          gap: 8,
          padding: 10,
          borderTop: '1px solid #3A2E1C',
        }}>
        <input
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
          placeholder="Envoyer un message…"
          maxLength={500}
          style={{
            flex: 1,
            padding: '9px 12px',
            background: '#0F0C07',
            border: '1px solid #3A2E1C',
            color: '#F5EFE0',
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: 13,
            outline: 'none',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#F5C518')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#3A2E1C')}
        />
        <button
          type="submit"
          disabled={!chatText.trim()}
          style={{
            padding: '0 16px',
            background: chatText.trim()
              ? 'linear-gradient(135deg,#F5C518,#C29A0F)'
              : '#14100A',
            border: 0,
            color: chatText.trim() ? '#0B0906' : '#6B5A3E',
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 700,
            cursor: chatText.trim() ? 'pointer' : 'not-allowed',
            clipPath: CUT_SM,
          }}>
          Envoyer
        </button>
      </form>
    </div>
  );
};

const GraveyardDrawer = ({
  cards,
  banished,
  label,
  onClose,
}: {
  cards: DeckCard[];
  banished: DeckCard[];
  label: string;
  onClose: () => void;
}) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 150,
      background: 'rgba(11,9,6,.75)',
      backdropFilter: 'blur(6px)',
      display: 'grid',
      placeItems: 'center',
      padding: 20,
    }}>
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: 720,
        maxHeight: '80vh',
        overflowY: 'auto',
        padding: '24px 26px',
        background: 'linear-gradient(160deg,#1A1510,#0D0A06)',
        border: '1px solid #FF2E88',
        clipPath: CUT_ARENA,
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: 'italic',
              fontSize: 11,
              letterSpacing: '0.28em',
              color: '#FF2E88',
              textTransform: 'uppercase',
            }}>
            — Sceau des âmes tombées —
          </div>
          <h3
            style={{
              margin: '4px 0 0',
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 20,
              color: '#F5EFE0',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
            {label}
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            border: '1px solid #3A2E1C',
            background: 'transparent',
            color: '#A99C86',
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 16,
            cursor: 'pointer',
          }}>
          ×
        </button>
      </div>
      <SectionList title={`Cimetière (${cards.length})`} cards={cards} accent="#FF2E88" />
      {banished.length > 0 && (
        <SectionList title={`Bannies (${banished.length})`} cards={banished} accent="#22D3EE" />
      )}
    </div>
  </div>
);

const SectionList = ({ title, cards, accent }: { title: string; cards: DeckCard[]; accent: string }) => (
  <div style={{ marginTop: 14 }}>
    <div
      style={{
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 10,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: accent,
        marginBottom: 8,
      }}>
      {title}
    </div>
    {cards.length === 0 ? (
      <div style={{ color: '#6B5A3E', fontSize: 12, fontStyle: 'italic' }}>Vide.</div>
    ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(88px,1fr))', gap: 8 }}>
        {cards.map((dc, i) => (
          <div
            key={`g-${i}`}
            title={dc.card?.name}
            style={{
              aspectRatio: '59 / 86',
              background: 'linear-gradient(150deg,#221B12,#14100A)',
              border: `1px solid ${accent}44`,
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              cursor: 'default',
            }}>
            {dc.card?.card_images?.[0]?.image_url_small ? (
              <img
                src={dc.card.card_images[0].image_url_small}
                alt={dc.card.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ fontSize: 9, color: '#F5EFE0', padding: 4, textAlign: 'center' }}>
                {dc.card?.name}
              </span>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

export default DuelRoom;
