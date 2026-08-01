import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import AppBackground from '../components/decor/AppBackground';
import CornerOrnaments from '../components/decor/CornerOrnaments';
import HeroTitle from '../components/decor/HeroTitle';
import { GlyphEye, GlyphPyramid, GlyphAnkh } from '../components/decor/Glyphs';

/**
 * Landing publique « Sanctuaire du Millénium ».
 * Hero 2 colonnes (baseline + CTAs à gauche, obélisque + cartes flottantes à droite),
 * grille de features, section stats, testimonials, CTA final, footer.
 */
const Home = () => {
  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <AppBackground />
      <CornerOrnaments />

      {/* ─── NAV publique minimaliste ───────────────────────────────── */}
      <nav
        className="sticky top-0 z-40 backdrop-blur-md"
        style={{
          background:
            'linear-gradient(180deg, rgba(11,8,19,0.85), rgba(11,8,19,0.55))',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <GlyphPyramid
              style={{ width: 32, height: 32, color: 'var(--gold)' }}
            />
            <span
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 900,
                fontSize: 17,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text)',
              }}
            >
              Keit<span style={{ color: 'var(--gold)' }}>land</span>
            </span>
          </Link>
          <div className="hidden md:flex flex-1 gap-1">
            <a
              href="#features"
              className="px-4 py-2 no-underline transition-colors"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 12,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              Fonctionnalités
            </a>
            <a
              href="#numbers"
              className="px-4 py-2 no-underline transition-colors"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 12,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              Chiffres
            </a>
            <a
              href="#voix"
              className="px-4 py-2 no-underline transition-colors"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 12,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              Témoignages
            </a>
          </div>
          <div className="flex gap-2 items-center ml-auto">
            <Link to="/login">
              <Button variant="ghost" size="md">
                Se connecter
              </Button>
            </Link>
            <Link to="/register">
              <Button variant="primary" size="md" glitch>
                S'inscrire
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-20">
        {/* ─── HERO ─────────────────────────────────────────────────── */}
        <section
          className="max-w-7xl mx-auto px-4 sm:px-8 py-16 lg:py-24 grid gap-12 items-center"
          style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)' }}
        >
          <div className="relative z-10 col-span-full lg:col-span-1">
            <HeroTitle
              kicker="— Sanctuaire du Millénium —"
              title={
                <>
                  Ta collection
                  <br />
                  mérite un
                  <br />
                  <span style={{ color: 'var(--gold)', WebkitTextFillColor: 'var(--gold)' }}>
                    Sanctuaire.
                  </span>
                </>
              }
              sub="Cartographie chaque carte que tu possèdes. Construis des decks, invoque-les devant la communauté, scanne tes nouveautés en un cliché. La vitrine que les autres apps n'ont jamais su te donner."
            />
            <div className="flex flex-wrap gap-4 mt-8">
              <Link to="/register">
                <Button variant="primary" size="lg" glitch>
                  S'inscrire — c'est gratuit
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="secondary" size="lg">
                  Voir un deck public
                </Button>
              </Link>
            </div>

            {/* Stats mini */}
            <div className="grid grid-cols-3 gap-6 mt-12 max-w-lg">
              {[
                { v: '13 240', l: 'Cartes' },
                { v: '2 847', l: 'Duellistes' },
                { v: '18 906', l: 'Decks' },
              ].map((s) => (
                <div key={s.l} className="text-center">
                  <div
                    style={{
                      fontFamily: "'Orbitron', sans-serif",
                      fontWeight: 900,
                      fontSize: 28,
                      color: 'var(--gold)',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {s.v}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      marginTop: 4,
                    }}
                  >
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero right — obélisque + cartes flottantes */}
          <div className="hidden lg:grid place-items-center relative" style={{ height: 620 }}>
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(245,197,24,0.15), transparent 60%)',
                filter: 'blur(40px)',
              }}
            />
            <svg
              viewBox="0 0 200 400"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{
                width: '80%',
                height: '100%',
                color: 'var(--gold)',
                opacity: 0.6,
                filter: 'drop-shadow(0 0 20px rgba(245,197,24,0.3))',
              }}
            >
              <path d="M40 380 L160 380 L150 360 L50 360 Z" />
              <path d="M50 360 L150 360 L145 340 L55 340 Z" opacity="0.7" />
              <path d="M60 340 L140 340 L130 60 L70 60 Z" />
              <path d="M70 60 L130 60 L100 20 Z" />
              <ellipse cx="100" cy="180" rx="24" ry="14" />
              <circle cx="100" cy="180" r="7" />
              <circle cx="100" cy="180" r="3" fill="currentColor" />
              <path
                d="M100 220 V320 M85 240 H115 M85 260 H115 M85 280 H115 M85 300 H115"
                opacity="0.4"
              />
              <path d="M100 8 L108 24 L92 24 Z" opacity="0.7" />
            </svg>
          </div>
        </section>

        {/* ─── FEATURES ─────────────────────────────────────────────── */}
        <section
          id="features"
          className="max-w-7xl mx-auto px-4 sm:px-8 py-20"
        >
          <HeroTitle
            kicker="— Ce que tu peux faire —"
            title={
              <>
                Quatre piliers.
                <br />
                Un seul temple.
              </>
            }
            sub="Chaque fonctionnalité est pensée pour le duelliste qui prend sa collection au sérieux. Pas de gadget, pas de bruit. Juste ce qu'il faut."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
            {[
              {
                icon: <GlyphEye />,
                title: 'Collection',
                desc: 'Chaque carte cataloguée, filtrée par langue, rareté, archétype. Halo dynamique selon la rareté.',
              },
              {
                icon: <GlyphPyramid />,
                title: 'Deck Builder',
                desc: 'Construis Main, Extra et Side depuis ta collection. Validation banlist en temps réel. Import / export .ydk.',
              },
              {
                icon: <GlyphAnkh />,
                title: 'Scan IA',
                desc: 'Photographie tes nouvelles cartes, l\'IA Claude Vision les identifie et les ajoute. Un booster en 30 s.',
              },
              {
                icon: <GlyphEye />,
                title: 'Social',
                desc: 'Partage tes decks publics, suis les créateurs, commente. Une communauté qui célèbre le deckbuilding.',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="cyber-tile p-6 transition-transform hover:-translate-y-1"
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    color: 'var(--gold)',
                    marginBottom: 16,
                  }}
                >
                  {f.icon}
                </div>
                <div
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 700,
                    fontSize: 16,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--gold)',
                    marginBottom: 8,
                  }}
                >
                  {f.title}
                </div>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: 'var(--text-muted)',
                  }}
                >
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── NUMBERS ──────────────────────────────────────────────── */}
        <section
          id="numbers"
          className="max-w-7xl mx-auto px-4 sm:px-8 py-20"
        >
          <HeroTitle
            kicker="— Le sanctuaire en chiffres —"
            title={
              <>
                Une communauté
                <br />
                déjà bien vivante.
              </>
            }
            sub="Les décombres d'anciens forums, transformés en vitrine moderne. Rejoins ceux qui construisent déjà."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
            {[
              {
                v: '13 240',
                l: 'Cartes cataloguées',
                s: 'Banlist TCG · OCG · Master Duel',
              },
              {
                v: '2 847',
                l: 'Duellistes actifs',
                s: 'Depuis les 30 derniers jours',
              },
              {
                v: '18 906',
                l: 'Decks partagés',
                s: 'Meta, casuals, jank inclus',
              },
            ].map((n) => (
              <div
                key={n.l}
                className="cyber-panel p-8 text-center"
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 900,
                    fontSize: 48,
                    color: 'var(--gold)',
                    letterSpacing: '0.02em',
                    filter: 'drop-shadow(0 0 20px rgba(245,197,24,0.2))',
                  }}
                >
                  {n.v}
                </div>
                <div
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 13,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'var(--text)',
                    marginTop: 8,
                  }}
                >
                  {n.l}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    marginTop: 4,
                    fontStyle: 'italic',
                  }}
                >
                  {n.s}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── TESTIMONIALS ─────────────────────────────────────────── */}
        <section id="voix" className="max-w-7xl mx-auto px-4 sm:px-8 py-20">
          <HeroTitle
            kicker="— Les voix du sanctuaire —"
            title="Ce qu'on nous dit."
            sub="Trois joueurs qui ont troqué Excel et YGOProDeck contre Keitland. Ils racontent."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
            {[
              {
                quote:
                  "J'avais 2 300 cartes dans un classeur, aucune idée de ce que je possédais. En un weekend et deux paquets de scans, tout est là. Enfin je respire.",
                name: 'Sébastien R.',
                meta: 'Collectionneur · Lyon',
                initials: 'SR',
              },
              {
                quote:
                  'Le deck builder valide ma banlist en temps réel, exporte en .ydk propre. Zéro friction. Le reste du monde en 2010, ce site en 2026.',
                name: 'Manon K.',
                meta: 'Compétitive · YCS regular',
                initials: 'MK',
              },
              {
                quote:
                  "J'ai partagé mon deck Sky Striker sur le feed, reçu 40 likes en deux heures. Le premier endroit où je poste un deck sans avoir honte du design.",
                name: 'Thomas L.',
                meta: 'Deckbuilder · Bruxelles',
                initials: 'TL',
              },
            ].map((t) => (
              <div
                key={t.initials}
                className="cyber-tile p-6 flex flex-col"
                style={{
                  background: 'var(--panel-2)',
                  border: '1px solid var(--border)',
                }}
              >
                <p
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 18,
                    lineHeight: 1.5,
                    fontStyle: 'italic',
                    color: 'var(--text)',
                    flex: 1,
                  }}
                >
                  « {t.quote} »
                </p>
                <div className="flex items-center gap-3 mt-6">
                  <div
                    className="w-11 h-11 flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))',
                      color: 'var(--on-gold)',
                      fontFamily: "'Orbitron', sans-serif",
                      fontWeight: 700,
                      fontSize: 13,
                      letterSpacing: '0.1em',
                      clipPath:
                        'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
                    }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--text)',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {t.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {t.meta}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── CTA FINAL ────────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-8 py-20">
          <div
            className="cyber-panel cyber-panel--glow p-12 text-center relative overflow-hidden"
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--border-gold, var(--gold-dim))',
            }}
          >
            <HeroTitle
              kicker="— Rejoins-nous —"
              title={
                <>
                  Rejoins
                  <br />
                  le Sanctuaire.
                </>
              }
              sub="Compte gratuit. Aucune carte bancaire. Ta collection reste la tienne, exportable à tout moment. Trente secondes pour commencer."
              className="mx-auto"
            />
            <div className="flex flex-wrap gap-4 justify-center mt-8">
              <Link to="/register">
                <Button variant="primary" size="lg" glitch>
                  Créer mon compte
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="ghost" size="lg">
                  Déjà membre ? Se connecter
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ──────────────────────────────────────────────── */}
      <footer
        className="relative z-20 max-w-7xl mx-auto px-4 sm:px-8 py-10 flex flex-wrap justify-between items-center gap-4"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center gap-3"
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: 'italic',
            fontSize: 14,
            letterSpacing: '0.14em',
            color: 'var(--text-muted)',
          }}
        >
          <GlyphPyramid style={{ width: 24, height: 24, color: 'var(--gold-dim)' }} />
          Keitland · Le sanctuaire des duellistes · MMXXVI
        </div>
        <div className="flex gap-6">
          {['Mentions légales', 'Confidentialité', 'API YGOProDeck', 'GitHub'].map(
            (l) => (
              <a
                key={l}
                href="#"
                className="no-underline"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}
              >
                {l}
              </a>
            )
          )}
        </div>
      </footer>
    </div>
  );
};

export default Home;
