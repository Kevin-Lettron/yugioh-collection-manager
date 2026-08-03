import { Link } from 'react-router-dom';
import AppBackground from '../components/decor/AppBackground';
import CornerOrnaments from '../components/decor/CornerOrnaments';
import { GlyphPyramid, GlyphEye } from '../components/decor/Glyphs';
import { MillenniumMark, ScanIcon, DeckIcon, SocialIcon, CardIcon } from '../components/decor/Icons';

/**
 * Landing publique — pixel-perfect « Sanctuaire du Millénium » (DesktopFrame isHome).
 * Hero grid 1.05fr/.95fr, 3 obélisques + fan de 3 cartes flottantes, 3 stats,
 * puis grid 3 features biseautées (Scan IA / Ateliers / Vitrine publique).
 */

const HERO_STATS = [
  { value: '3 214', label: 'Duellistes' },
  { value: '1,2 M', label: 'Cartes scannées' },
  { value: '18 k', label: 'Decks publics' },
];

const HERO_CARDS = [
  {
    wrap: {
      position: 'absolute' as const,
      left: 70,
      top: 120,
      width: 150,
      transform: 'rotate(-7deg)',
      animation: 'san-float 12s ease-in-out infinite',
    },
    ring: 'inset 0 0 0 1px var(--gold)',
    glow: '0 0 26px rgba(245,197,24,.42)',
    plinthColor: 'var(--gold)',
  },
  {
    wrap: {
      position: 'absolute' as const,
      left: 210,
      top: 60,
      width: 170,
      zIndex: 2,
      animation: 'san-float 12s ease-in-out -4s infinite',
    },
    ring: 'inset 0 0 0 1px var(--magenta)',
    glow: '0 0 16px rgba(255,46,136,.45),0 0 26px rgba(34,211,238,.32)',
    plinthColor: 'var(--magenta)',
  },
  {
    wrap: {
      position: 'absolute' as const,
      left: 370,
      top: 130,
      width: 150,
      transform: 'rotate(8deg)',
      animation: 'san-float 12s ease-in-out -8s infinite',
    },
    ring: 'inset 0 0 0 1px rgba(168,85,247,.55)',
    glow: '0 0 18px rgba(168,85,247,.3)',
    plinthColor: 'var(--violet-soft)',
  },
];

const FEATURES = [
  {
    icon: <ScanIcon size={30} />,
    title: 'Scan par l’IA',
    body: 'Pose la carte, l’oracle lit le nom, l’extension, la rareté et la langue. Trois secondes par relique.',
  },
  {
    icon: <DeckIcon size={30} />,
    title: 'Ateliers de deck',
    body: 'Construis depuis ta seule collection réelle. Compteurs 40/15/15 et ratio conseillé en direct.',
  },
  {
    icon: <SocialIcon size={30} />,
    title: 'Vitrine publique',
    body: 'Ton profil devient une page qu’on montre. Likes, commentaires, copies de deck.',
  },
];

// Style helper « bouton primary or/violet » de la maquette (isolate + 2 clip-path)
const CUT_BTN = 'polygon(0 0,100% 0,100% 100%,95% 100%,95% 90%,85% 90%,85% 100%,8% 100%,0 70%)';
const CUT_SM = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';
const CUT_TILE = 'polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,20px 100%,0 calc(100% - 20px))';

// Style d'une carte flottante (art plate + plinth doré)
const cardArt = (ring: string, glow: string): React.CSSProperties => ({
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  placeItems: 'center',
  width: '100%',
  aspectRatio: '59 / 86',
  background: 'linear-gradient(135deg,var(--panel-2),var(--bg-elev))',
  border: '1px solid var(--border)',
  clipPath: 'polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)',
  boxShadow: `${ring},${glow},${glow},0 18px 26px -12px rgba(0,0,0,.9)`,
  transform: 'translateY(-5px)',
});

const plinth = (color: string): React.CSSProperties => ({
  height: 11,
  margin: '0 6%',
  background: `radial-gradient(ellipse at 50% 0%,${color} 0%,transparent 68%)`,
  opacity: 0.5,
  filter: 'blur(2.5px)',
});

const Home = () => {
  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: 'var(--bg)' }}>
      <AppBackground />
      <CornerOrnaments />

      {/* Nav publique fidèle à la maquette (nav 64px, glass, wordmark Keitland) */}
      <nav
        className="sticky top-0 z-40"
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 36,
          padding: '0 40px',
          background: 'linear-gradient(180deg,rgba(11,9,6,.92),rgba(11,9,6,.68))',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          borderBottom: '1px solid var(--border)',
        }}>
        <Link to="/" className="flex items-center gap-2.5" style={{ textDecoration: 'none' }}>
          <MillenniumMark size={30} className="text-blue-600" title="Keitland" />
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
        </Link>
        <span style={{ flex: 1 }} />
        <div className="flex items-center gap-3">
          <Link to="/login">
            <button
              style={{
                height: 40,
                padding: '0 22px',
                border: '1px solid var(--gold)',
                background: 'transparent',
                color: 'var(--text)',
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                clipPath: CUT_SM,
              }}>
              Se connecter
            </button>
          </Link>
          <Link to="/register">
            <button
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
              S'inscrire
            </button>
          </Link>
        </div>
      </nav>

      <main className="relative z-20">
        {/* HERO : 2 col 1.05fr/.95fr */}
        <section
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,.95fr)',
            gap: 40,
            alignItems: 'center',
            padding: '74px 64px 60px',
            minHeight: 540,
            maxWidth: 1440,
            margin: '0 auto',
          }}
          className="max-lg:!grid-cols-1 max-lg:!p-8">
          <div>
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: 'italic',
                fontSize: 13,
                letterSpacing: '0.34em',
                color: 'var(--gold)',
                textTransform: 'uppercase',
              }}>
              — Sanctuaire du Millénium —
            </div>
            <h1
              style={{
                margin: '16px 0 0',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 'clamp(40px, 5vw, 66px)',
                fontWeight: 900,
                lineHeight: 0.94,
                letterSpacing: '0.01em',
                textTransform: 'uppercase',
                background: 'linear-gradient(180deg,var(--text) 20%,var(--gold-dim) 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: 'drop-shadow(0 0 24px rgba(245,197,24,.18))',
              }}>
              Ta collection
              <br />
              mérite un temple
            </h1>
            <p
              style={{
                margin: '22px 0 0',
                maxWidth: 520,
                fontSize: 19,
                lineHeight: 1.55,
                color: 'var(--text-muted)',
                textWrap: 'pretty' as any,
              }}>
              Scanne tes cartes physiques, dresse tes decks, ouvre ta vitrine au reste du monde. Ce que
              tu as passé dix ans à rassembler se regarde enfin.
            </p>
            <div style={{ marginTop: 34, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <Link to="/register">
                <button
                  style={{
                    height: 56,
                    padding: '0 34px',
                    position: 'relative',
                    isolation: 'isolate',
                    border: 0,
                    background: 'transparent',
                    color: 'var(--bg)',
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 700,
                    fontSize: 14,
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
                  Ouvrir mon sanctuaire
                </button>
              </Link>
              <Link to="/login">
                <button
                  style={{
                    height: 52,
                    padding: '0 26px',
                    border: '1px solid var(--gold)',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    clipPath: CUT_SM,
                  }}>
                  Voir une vitrine
                </button>
              </Link>
            </div>
            <div style={{ marginTop: 38, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              {HERO_STATS.map((s) => (
                <div key={s.label}>
                  <div
                    style={{
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 26,
                      fontWeight: 700,
                      color: 'var(--gold)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                    {s.value}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 9,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Colonne droite : 3 obélisques + fan de 3 cartes */}
          <div style={{ position: 'relative', height: 470 }} className="max-lg:hidden">
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-end',
                gap: 44,
                opacity: 0.55,
                pointerEvents: 'none',
              }}>
              <div
                style={{
                  width: 40,
                  height: 330,
                  background:
                    'linear-gradient(180deg,rgba(58,46,28,.95),rgba(11,9,6,0))',
                  borderLeft: '1px solid rgba(245,197,24,.26)',
                  borderRight: '1px solid rgba(245,197,24,.1)',
                }}
              />
              <div
                style={{
                  width: 54,
                  height: 410,
                  background:
                    'linear-gradient(180deg,rgba(58,46,28,1),rgba(11,9,6,0))',
                  borderLeft: '1px solid rgba(245,197,24,.3)',
                  borderRight: '1px solid rgba(245,197,24,.12)',
                }}
              />
              <div
                style={{
                  width: 40,
                  height: 330,
                  background:
                    'linear-gradient(180deg,rgba(58,46,28,.95),rgba(11,9,6,0))',
                  borderLeft: '1px solid rgba(245,197,24,.26)',
                  borderRight: '1px solid rgba(245,197,24,.1)',
                }}
              />
            </div>
            {HERO_CARDS.map((c, i) => (
              <div key={i} style={c.wrap}>
                <div style={cardArt(c.ring, c.glow)}>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'repeating-linear-gradient(45deg,transparent 0 10px,rgba(168,85,247,.05) 10px 11px),linear-gradient(150deg,var(--panel-2),var(--bg-elev))',
                    }}
                  />
                  <CardIcon size={40} className="relative" />
                </div>
                <div style={plinth(c.plinthColor)} />
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES : grille 3 cols biseautée */}
        <section
          style={{
            position: 'relative',
            padding: '0 64px 70px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 20,
            maxWidth: 1440,
            margin: '0 auto',
          }}
          className="max-md:!grid-cols-1 max-md:!p-8">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                padding: '26px 26px 28px',
                background: 'linear-gradient(150deg,var(--panel),var(--bg-sunken))',
                border: '1px solid var(--border)',
                clipPath: CUT_TILE,
                transition: 'border-color 200ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--gold-dim)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <div style={{ color: 'var(--gold)' }}>{f.icon}</div>
              <div
                style={{
                  marginTop: 16,
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text)',
                }}>
                {f.title}
              </div>
              <p
                style={{
                  margin: '10px 0 0',
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: 'var(--text-muted)',
                  textWrap: 'pretty' as any,
                }}>
                {f.body}
              </p>
            </div>
          ))}
        </section>

        {/* Bloc « À venir » : témoignages chiffrés promis mais pas encore data-backed */}
        <section
          style={{
            padding: '0 64px 60px',
            maxWidth: 1440,
            margin: '0 auto',
          }}>
          <div
            style={{
              padding: '30px 34px',
              background: 'linear-gradient(150deg,var(--panel),var(--bg-sunken))',
              border: '1px dashed var(--border)',
              clipPath: CUT_TILE,
              display: 'flex',
              alignItems: 'center',
              gap: 20,
            }}>
            <GlyphEye style={{ width: 40, height: 40, color: 'var(--gold-dim)', flex: 'none' }} />
            <div>
              <div
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--gold)',
                }}>
                Voix du sanctuaire — À venir
              </div>
              <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5 }}>
                Trois témoignages de duellistes seront affichés dès qu’on aura recueilli les retours des
                premiers gardiens.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer
        style={{
          position: 'relative',
          zIndex: 20,
          maxWidth: 1440,
          margin: '0 auto',
          padding: '32px 64px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          borderTop: '1px solid var(--border)',
        }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: 'italic',
            fontSize: 13,
            letterSpacing: '0.14em',
            color: 'var(--text-muted)',
          }}>
          <GlyphPyramid style={{ width: 22, height: 22, color: 'var(--gold-dim)' }} />
          Keitland · Le sanctuaire des duellistes · MMXXVI
        </div>
        <div style={{ display: 'flex', gap: 22 }}>
          {['Mentions légales', 'Confidentialité', 'API YGOProDeck', 'GitHub'].map((l) => (
            <a
              key={l}
              href="#"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                textDecoration: 'none',
              }}>
              {l}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
};

export default Home;
