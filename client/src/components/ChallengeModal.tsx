import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Deck } from '../../../shared/types';
import api from '../services/api';
import duelApi from '../services/duelApi';

const CUT_PANEL = 'polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,22px 100%,0 calc(100% - 22px))';
const CUT_BTN = 'polygon(0 0,100% 0,100% 100%,95% 100%,95% 90%,85% 90%,85% 100%,8% 100%,0 70%)';
const CUT_SM = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';
const CUT_CHIP = 'polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)';

interface Props {
  open: boolean;
  onClose: () => void;
  opponent: { id: number; username: string };
  onSuccess?: () => void;
}

/**
 * ChallengeModal — modal pour envoyer un défi à un autre duelliste.
 * Layout : panel biseauté clip-path, dropdown custom de decks (comme celui de
 * rareté sur Collection), CTA doré/violet. Se ferme en cliquant l'overlay ou ESC.
 */
const ChallengeModal = ({ open, onClose, opponent, onSuccess }: Props) => {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
  const [deckOpen, setDeckOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // 'standard' = banlist TCG appliquee (max 3, Limited, Forbidden).
  // 'free' = aucune restriction hors tailles minimum du deck.
  const [rulesMode, setRulesMode] = useState<'standard' | 'free'>('standard');
  const deckRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get('/decks')
      .then((res) => {
        const list: Deck[] = res.data.data || res.data || [];
        setDecks(list);
        if (list.length > 0) setSelectedDeckId(list[0].id);
      })
      .catch(() => setDecks([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!deckOpen) return;
    const onClick = (e: MouseEvent) => {
      if (deckRef.current && !deckRef.current.contains(e.target as Node)) setDeckOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [deckOpen]);

  const handleSubmit = async () => {
    if (!selectedDeckId) {
      toast.error('Choisis un deck pour ton défi');
      return;
    }
    setSubmitting(true);
    try {
      await duelApi.challenge({
        opponent_id: opponent.id,
        challenger_deck_id: selectedDeckId,
        rules_mode: rulesMode,
      });
      toast.success(`Défi envoyé à @${opponent.username}`);
      onClose();
      onSuccess?.();
    } catch (err) {
      // Erreur toast gérée par api interceptor
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const selectedDeck = decks.find((d) => d.id === selectedDeckId) || null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(11,9,6,.82)',
        backdropFilter: 'blur(6px)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        animation: 'fadeIn 180ms ease',
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
        {/* Halo violet en fond */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 60% 40% at 50% 100%,rgba(168,85,247,.22),transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        {/* Grille or discrète */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(245,197,24,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(245,197,24,.05) 1px,transparent 1px)',
            backgroundSize: '28px 28px',
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
            — Sceau du duelliste —
          </div>
          <h2
            style={{
              margin: '8px 0 0',
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              color: '#F5EFE0',
              lineHeight: 1.05,
            }}>
            Envoyer un défi
          </h2>
          <p style={{ margin: '10px 0 0', fontSize: 14, color: '#A99C86' }}>
            Contre{' '}
            <span style={{ color: '#A855F7', fontWeight: 700 }}>@{opponent.username}</span>
          </p>

          {/* Sélecteur deck */}
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
              Choisis ton deck
            </label>
            {loading ? (
              <div
                style={{
                  height: 44,
                  border: '1px dashed #3A2E1C',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#A99C86',
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: 13,
                }}>
                Chargement des grimoires…
              </div>
            ) : decks.length === 0 ? (
              <div
                style={{
                  padding: '14px 16px',
                  border: '1px solid #FF4D6D',
                  background: 'rgba(255,77,109,.08)',
                  color: '#FF9AAF',
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: 13,
                }}>
                Tu n'as aucun deck. Crée-en un dans « Mes Decks » pour pouvoir défier.
              </div>
            ) : (
              <div ref={deckRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setDeckOpen((o) => !o)}
                  style={{
                    width: '100%',
                    padding: '12px 32px 12px 16px',
                    border: `1px solid ${selectedDeckId ? '#F5C518' : '#3A2E1C'}`,
                    background: selectedDeckId
                      ? 'linear-gradient(135deg,rgba(245,197,24,.18),rgba(168,85,247,.1))'
                      : '#1A1510',
                    color: '#F5EFE0',
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 12,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontWeight: 700,
                    clipPath: CUT_SM,
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                  <span style={{ flex: 1 }}>
                    {selectedDeck
                      ? selectedDeck.name
                      : 'Sélectionner un deck'}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      transform: deckOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform .15s',
                      color: '#F5C518',
                    }}>
                    ▼
                  </span>
                </button>
                {deckOpen && (
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
                      boxShadow: '0 22px 40px rgba(0,0,0,.7), 0 0 24px rgba(245,197,24,.12)',
                      clipPath:
                        'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))',
                      zIndex: 60,
                      padding: '6px 0',
                    }}>
                    {decks.map((d) => {
                      const active = d.id === selectedDeckId;
                      const main = d.main_deck?.reduce((s, c) => s + c.quantity, 0) || (d as any).main_deck_count || 0;
                      const extra = d.extra_deck?.reduce((s, c) => s + c.quantity, 0) || (d as any).extra_deck_count || 0;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            setSelectedDeckId(d.id);
                            setDeckOpen(false);
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
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            fontWeight: active ? 700 : 500,
                          }}
                          onMouseEnter={(e) => {
                            if (!active) e.currentTarget.style.background = 'rgba(245,197,24,.06)';
                          }}
                          onMouseLeave={(e) => {
                            if (!active) e.currentTarget.style.background = 'transparent';
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
                          <span
                            style={{
                              fontSize: 10,
                              color: active ? '#F5C518' : '#A99C86',
                              fontVariantNumeric: 'tabular-nums',
                            }}>
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

          {/* Choix des regles */}
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
              Regles du duel
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(['standard', 'free'] as const).map((mode) => {
                const active = rulesMode === mode;
                const label = mode === 'standard' ? 'Standard' : 'Libre';
                const desc =
                  mode === 'standard'
                    ? 'Banlist TCG · max 3'
                    : 'Aucune restriction';
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRulesMode(mode)}
                    style={{
                      padding: '10px 12px',
                      border: `1px solid ${active ? '#F5C518' : '#3A2E1C'}`,
                      background: active
                        ? 'linear-gradient(135deg,rgba(245,197,24,.18),rgba(168,85,247,.1))'
                        : '#1A1510',
                      color: active ? '#F5C518' : '#F5EFE0',
                      fontFamily: "'Orbitron', sans-serif",
                      cursor: 'pointer',
                      textAlign: 'left',
                      clipPath: CUT_SM,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                      }}>
                      {label}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: active ? '#F5EFE0' : '#A99C86',
                        letterSpacing: '0.05em',
                      }}>
                      {desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div
            style={{
              marginTop: 26,
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}>
            <button
              onClick={onClose}
              disabled={submitting}
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
                cursor: submitting ? 'not-allowed' : 'pointer',
                clipPath: CUT_SM,
              }}>
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || decks.length === 0 || !selectedDeckId}
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
                  submitting || decks.length === 0 || !selectedDeckId ? 'not-allowed' : 'pointer',
                opacity: submitting || decks.length === 0 || !selectedDeckId ? 0.5 : 1,
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
              {submitting ? 'Envoi…' : 'Envoyer le défi'}
            </button>
          </div>
          <p
            style={{
              margin: '14px 0 0',
              fontSize: 11,
              color: '#6B5A3E',
              fontStyle: 'italic',
            }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, background: '#F5C518', marginRight: 6, clipPath: CUT_CHIP }} />
            L'adversaire recevra une notification et choisira son propre deck.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChallengeModal;
