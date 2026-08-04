import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Deck, DeckStats } from '../../../shared/types';
import api from '../services/api';
import toast from 'react-hot-toast';
import AppBackground from '../components/decor/AppBackground';
import CornerOrnaments from '../components/decor/CornerOrnaments';
import CardTile from '../components/decor/CardTile';
import { MillenniumMark, CardIcon } from '../components/decor/Icons';

const CUT_BTN = 'polygon(0 0,100% 0,100% 100%,95% 100%,95% 90%,85% 90%,85% 100%,8% 100%,0 70%)';
const CUT_SM = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';
const CUT_PANEL = 'polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px))';
const CUT_ARENA = 'polygon(0 0,calc(100% - 24px) 0,100% 24px,100% 100%,24px 100%,0 calc(100% - 24px))';

/**
 * DeckShare — layout `isArena` (DesktopFrame l.211-300) sans navbar full sanctuaire.
 * Nav publique minimaliste, plateau 3D, sidebar avec CTA « Copier ce deck »
 * pour user connecté, ou « Créer un compte » pour visiteur.
 */
const DeckShare = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [stats, setStats] = useState<DeckStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (shareToken) fetchSharedDeck();
  }, [shareToken]);

  const fetchSharedDeck = async () => {
    try {
      const response = await api.get(`/decks/shared/${shareToken}`);
      setDeck(response.data.deck);
      setStats(response.data.stats || null);
    } catch (err: any) {
      if (err.response?.status === 404) setError('Ce lien est invalide ou expiré.');
      else setError('Impossible de charger le deck.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDeck = async () => {
    if (!user) {
      navigate('/register');
      return;
    }
    if (!deck) return;
    setCopying(true);
    try {
      await api.post(`/social/wishlist/${deck.id}`);
      toast.success('Deck ajouté à ta wishlist');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Impossible');
    } finally {
      setCopying(false);
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

  if (error || !deck) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'transparent', padding: 32 }}>
        <div
          style={{
            maxWidth: 460,
            textAlign: 'center',
            padding: '40px 32px',
            background: 'linear-gradient(160deg,var(--panel),var(--bg))',
            border: '1px solid var(--border)',
            clipPath: 'polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,22px 100%,0 calc(100% - 22px))',
          }}>
          <MillenniumMark size={56} className="text-blue-600" />
          <h2
            style={{
              margin: '16px 0 8px',
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 24,
              fontWeight: 900,
              color: 'var(--text)',
              textTransform: 'uppercase',
            }}>
            Lien invalide
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>{error}</p>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '10px 22px',
              background: 'var(--gold)',
              color: 'var(--bg)',
              border: 0,
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              clipPath: CUT_SM,
            }}>
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  const mainCount = deck.main_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
  const extraCount = deck.extra_deck?.reduce((s, c) => s + c.quantity, 0) || 0;

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: 'transparent' }}>
      <AppBackground />
      <CornerOrnaments />

      {/* Navbar publique minimaliste */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '0 40px',
          background: 'linear-gradient(180deg,rgba(11,9,6,.92),rgba(11,9,6,.68))',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          borderBottom: '1px solid var(--border)',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MillenniumMark size={28} className="text-blue-600" />
          <span
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 900,
              fontSize: 14,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--text)',
            }}>
            Keit<span style={{ color: 'var(--gold)' }}>land</span>
          </span>
        </div>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: 'italic',
            fontSize: 11,
            letterSpacing: '0.2em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
          }}>
          — Vitrine publique —
        </span>
      </nav>

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
          <div>
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: 'italic',
                fontSize: 11,
                letterSpacing: '0.3em',
                color: 'var(--gold)',
                textTransform: 'uppercase',
              }}>
              — Vitrine ouverte —
            </div>
            <h1
              style={{
                margin: '8px 0 0',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 40,
                fontWeight: 900,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                color: 'var(--text)',
                lineHeight: 1,
              }}>
              {deck.name}
            </h1>
            <div style={{ marginTop: 8, fontSize: 15, color: 'var(--text-muted)' }}>
              par{' '}
              <span style={{ color: 'var(--violet)' }}>@{deck.user?.username}</span>{' '}
              ·{' '}
              <span style={{ fontFamily: "'Orbitron', sans-serif", fontVariantNumeric: 'tabular-nums', color: 'var(--gold)' }}>
                {mainCount} · {extraCount} · 0
              </span>
            </div>
          </div>

          {/* Plateau — placeholder minimal */}
          <div
            style={{
              marginTop: 26,
              position: 'relative',
              padding: '44px 40px 34px',
              background: 'linear-gradient(180deg,var(--bg-elev),var(--bg))',
              border: '1px solid var(--border)',
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
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 82,
                      height: 112,
                      display: 'grid',
                      placeItems: 'center',
                      background:
                        i < 3 ? 'linear-gradient(150deg,var(--border-soft),var(--bg-elev))' : 'rgba(255,255,255,.02)',
                      border: i < 3 ? '1px solid rgba(245,197,24,.55)' : '1px dashed rgba(245,197,24,.22)',
                      boxShadow: i < 3 ? '0 0 20px -4px rgba(245,197,24,.55)' : undefined,
                    }}>
                    {i < 3 && (
                      <span
                        style={{
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 9,
                          letterSpacing: '0.12em',
                          color: 'var(--text-muted)',
                          opacity: 0.75,
                        }}>
                        MONSTRE
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 82,
                      height: 112,
                      display: 'grid',
                      placeItems: 'center',
                      background:
                        i < 2 || i === 3
                          ? 'linear-gradient(150deg,var(--border-soft),var(--bg-elev))'
                          : 'rgba(255,255,255,.02)',
                      border:
                        i < 2
                          ? '1px solid rgba(168,85,247,.55)'
                          : i === 3
                          ? '1px solid rgba(34,211,238,.5)'
                          : '1px dashed rgba(245,197,24,.22)',
                    }}>
                    {(i < 2 || i === 3) && (
                      <span
                        style={{
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 9,
                          letterSpacing: '0.12em',
                          color: 'var(--text-muted)',
                          opacity: 0.75,
                        }}>
                        {i < 2 ? 'MAGIE' : 'PIÈGE'}
                      </span>
                    )}
                  </div>
                ))}
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
                color: 'var(--gold)',
              }}>
              Cartes clés
            </span>
            <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border),transparent)' }} />
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

          {/* Extra deck compact list */}
          {(deck.extra_deck || []).length > 0 && (
            <>
              <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 12,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--violet-soft)',
                  }}>
                  Extra deck
                </span>
                <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border),transparent)' }} />
              </div>
              <div
                style={{
                  marginTop: 18,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                  gap: 20,
                }}
                className="max-lg:!grid-cols-4 max-sm:!grid-cols-3">
                {(deck.extra_deck || []).map((dc, i) => (
                  <CardTile
                    key={dc.id}
                    uri={dc.card?.card_images?.[0]?.image_url_small}
                    name={dc.card?.name}
                    quantity={dc.quantity}
                    index={i}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              padding: 22,
              background: 'linear-gradient(150deg,var(--panel),var(--bg-sunken))',
              border: '1px solid var(--border)',
              clipPath: CUT_PANEL,
            }}>
            <button
              onClick={handleCopyDeck}
              disabled={copying}
              style={{
                width: '100%',
                height: 50,
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
                cursor: copying ? 'not-allowed' : 'pointer',
                opacity: copying ? 0.7 : 1,
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
              {user ? 'Copier ce deck' : 'Créer un compte pour copier'}
            </button>

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Archétype', value: (deck as any).archetype || '— À venir' },
                { label: 'Format', value: 'TCG Advanced' },
                {
                  label: 'Copié',
                  value: stats && stats.copies_count > 0 ? `${stats.copies_count} fois` : '— À venir',
                },
                {
                  label: 'Valeur du deck',
                  value: stats
                    ? stats.total_value_eur.toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                        maximumFractionDigits: 0,
                      })
                    : '— À venir',
                },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 14,
                    color: 'var(--text-muted)',
                    paddingBottom: 8,
                    borderBottom: '1px solid rgba(58,46,28,.6)',
                  }}>
                  <span>{m.label}</span>
                  <span
                    style={{
                      color: 'var(--text)',
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

          {!user && (
            <div
              style={{
                padding: 22,
                background: 'linear-gradient(150deg,var(--panel),var(--bg-sunken))',
                border: '1px solid var(--gold-dim)',
                clipPath: CUT_PANEL,
                boxShadow: '0 0 24px rgba(245,197,24,.25)',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <CardIcon size={20} className="text-blue-600" />
                <span
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 11,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'var(--gold)',
                  }}>
                  Rejoins-nous
                </span>
              </div>
              <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                Compte gratuit. Ta collection reste la tienne, exportable à tout moment.
              </p>
              <button
                onClick={() => navigate('/register')}
                style={{
                  width: '100%',
                  height: 44,
                  background: 'transparent',
                  color: 'var(--text)',
                  border: '1px solid var(--gold)',
                  fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  clipPath: CUT_SM,
                }}>
                Sceller mon compte
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeckShare;
