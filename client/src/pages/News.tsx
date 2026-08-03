import { useEffect, useMemo, useState } from 'react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { newsApi } from '../services/newsApi';
import AppNavbar from '../components/AppNavbar';
import AppBackground from '../components/decor/AppBackground';
import CornerOrnaments from '../components/decor/CornerOrnaments';
import { GlyphPyramid } from '../components/decor/Glyphs';
import TopicsModal from '../components/TopicsModal';
import type {
  NewsItem,
  NewsRelease,
  NewsTopic,
  NewsTopicMeta,
} from '../../../shared/types';

// ─── clip-paths biseautés (cohérence Collection / DeckView) ───────────────
const CUT_CHIP = 'polygon(0 0,calc(100% - 8px) 0,100% 100%,8px 100%)';
const CUT_CARD =
  'polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))';
const CUT_SM =
  'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';

interface ChipDef {
  label: string;
  topic: NewsTopic | null;
}

// L'ordre reflète la table du plan (§4) : TCG en premier, puis OCG, puis les
// axes plus spécifiques.
const CHIPS: ChipDef[] = [
  { label: 'Tous', topic: null },
  { label: 'TCG', topic: 'tcg' },
  { label: 'OCG', topic: 'ocg' },
  { label: 'Compétition', topic: 'competition' },
  { label: 'Sorties', topic: 'releases' },
  { label: 'Banlist', topic: 'banlist' },
  { label: 'Règles', topic: 'rulings' },
];

// Palette par thème — voir consignes brief (violet TCG, rose banlist, cyan
// rulings, or releases, bleu OCG, gris competition). Utilisé pour les badges
// posés sur chaque article.
const TOPIC_STYLE: Record<NewsTopic, { color: string; label: string }> = {
  tcg: { color: 'var(--violet)', label: 'TCG' },
  ocg: { color: '#5AA9FF', label: 'OCG' },
  competition: { color: 'var(--text-muted)', label: 'Compétition' },
  releases: { color: 'var(--gold)', label: 'Sortie' },
  banlist: { color: 'var(--magenta)', label: 'Banlist' },
  rulings: { color: 'var(--cyan)', label: 'Règle' },
};

const RTF = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
const MONTHS_FR = [
  'Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin',
  'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.',
];

/**
 * "il y a 3 h" — pas de dep date-fns, `Intl.RelativeTimeFormat` suffit.
 * On choisit la plus grande unité qui garde une valeur ≥ 1.
 */
function relative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const now = Date.now();
  const diffSec = Math.round((then - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return RTF.format(diffSec, 'second');
  if (abs < 3600) return RTF.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return RTF.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return RTF.format(Math.round(diffSec / 86400), 'day');
  if (abs < 86400 * 365) return RTF.format(Math.round(diffSec / (86400 * 30)), 'month');
  return RTF.format(Math.round(diffSec / (86400 * 365)), 'year');
}

function formatReleaseDate(iso: string): { day: string; month: string; full: string } {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (Number.isNaN(d.getTime())) return { day: '—', month: '', full: iso };
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS_FR[d.getMonth()] || '';
  return {
    day,
    month,
    full: `${day} ${month} ${d.getFullYear()}`,
  };
}

/**
 * Actualités — pixel-perfect Sanctuaire.
 * Fil articles à gauche, calendrier des sorties à droite (sticky desktop).
 * Chips en tête = filtre exclusif sur la sélection ; modal "Mes abonnements"
 * ne change que la pondération du fil (comportement documenté §4 du plan).
 */
const News = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const [chipIdx, setChipIdx] = useState(0);

  const [releases, setReleases] = useState<NewsRelease[]>([]);
  const [releasesLoading, setReleasesLoading] = useState(true);

  const [topics, setTopics] = useState<NewsTopicMeta[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const activeTopic = CHIPS[chipIdx].topic;

  const loadMoreRef = useInfiniteScroll({
    loading,
    hasMore,
    onLoadMore: () => setPage((p) => p + 1),
  });

  // Fil — reset à chaque changement de filtre, puis pagination.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    newsApi
      .list({
        topics: activeTopic ? [activeTopic] : undefined,
        page,
        limit: 30,
      })
      .then((r) => {
        if (cancelled) return;
        setItems((prev) => (page === 1 ? r.items : [...prev, ...r.items]));
        setTotal(r.total);
        setHasMore(page * r.limit < r.total);
        setInitialLoaded(true);
      })
      .catch(() => {
        // toast déjà géré par l'intercepteur axios
        if (!cancelled) setHasMore(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTopic, page]);

  // Sorties — chargement unique, fenêtre 90 j (upcoming).
  useEffect(() => {
    newsApi
      .getReleases('upcoming', 90)
      .then((r) => setReleases(r.releases))
      .catch(() => {})
      .finally(() => setReleasesLoading(false));
  }, []);

  // Thèmes — chargement unique pour hydrater la modal.
  useEffect(() => {
    newsApi
      .getTopics()
      .then((r) => setTopics(r.topics))
      .catch(() => {});
  }, []);

  const applyChip = (i: number) => {
    if (i === chipIdx) return;
    setChipIdx(i);
    setPage(1);
    setItems([]);
    setHasMore(true);
  };

  const subsCount = useMemo(
    () => topics.filter((t) => t.subscribed).length,
    [topics],
  );

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: 'transparent' }}>
      <AppBackground />
      <CornerOrnaments />
      <AppNavbar />

      <div
        style={{
          position: 'relative',
          zIndex: 20,
          padding: '46px 40px 60px',
          maxWidth: 1440,
          margin: '0 auto',
        }}
      >
        {/* ─── Header ───────────────────────────────────────────────── */}
        <div
          style={{
            position: 'relative',
            paddingBottom: 30,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <GlyphPyramid
            style={{
              position: 'absolute',
              right: 0,
              top: -16,
              width: 150,
              height: 150,
              color: 'var(--gold)',
              opacity: 0.07,
            }}
          />
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: 'italic',
              fontSize: 12,
              letterSpacing: '0.32em',
              color: 'var(--gold)',
              textTransform: 'uppercase',
            }}
          >
            — Vitrine des chroniques —
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
              background: 'linear-gradient(180deg,var(--text) 25%,var(--gold-dim) 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 0 18px rgba(245,197,24,.16))',
            }}
          >
            Actualités
          </h1>
          <p
            style={{
              margin: '14px 0 0',
              maxWidth: 640,
              fontSize: 17,
              lineHeight: 1.5,
              color: 'var(--text-muted)',
            }}
          >
            {total > 0
              ? `${total.toLocaleString('fr-FR')} articles du méta, du TCG et de la compétition.`
              : 'Le fil se remplit — les sources RSS sont rafraîchies toutes les 30 minutes.'}
          </p>
        </div>

        {/* ─── Chips filtre + CTA abonnements ───────────────────────── */}
        <div
          style={{
            marginTop: 22,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {CHIPS.map((c, i) => {
            const on = chipIdx === i;
            return (
              <button
                key={c.label}
                onClick={() => applyChip(i)}
                style={{
                  padding: '9px 17px',
                  border: `1px solid ${on ? 'var(--gold)' : 'var(--border)'}`,
                  background: on
                    ? 'linear-gradient(135deg,var(--gold),var(--gold-dim))'
                    : 'var(--panel)',
                  color: on ? 'var(--bg)' : 'var(--text-muted)',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontWeight: on ? 700 : 500,
                  clipPath: CUT_CHIP,
                  boxShadow: on ? '0 0 12px rgba(245,197,24,.35)' : 'none',
                }}
              >
                {c.label}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setModalOpen(true)}
            style={{
              padding: '10px 18px',
              border: '1px solid var(--violet)',
              background: 'rgba(168,85,247,.12)',
              color: 'var(--violet-soft)',
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontWeight: 700,
              clipPath: CUT_SM,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Mes abonnements
            {subsCount > 0 && (
              <span
                style={{
                  padding: '2px 8px',
                  background: 'var(--violet)',
                  color: 'var(--text)',
                  fontSize: 10,
                  borderRadius: 0,
                }}
              >
                {subsCount}
              </span>
            )}
          </button>
        </div>

        {/* ─── Grid principale ──────────────────────────────────────── */}
        <div
          style={{
            marginTop: 26,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
            gap: 26,
            alignItems: 'start',
          }}
          className="max-2xl:!grid-cols-1"
        >
          {/* ─── Colonne gauche — fil articles ─────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!initialLoaded && loading && <ArticleSkeletons />}

            {items.map((it) => (
              <ArticleCard key={it.id} item={it} />
            ))}

            {initialLoaded && !loading && items.length === 0 && (
              <EmptyState hasFilter={!!activeTopic} onClearFilter={() => applyChip(0)} />
            )}

            {loading && initialLoaded && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                <div
                  className="inline-block animate-spin"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: '3px solid rgba(245,197,24,.3)',
                    borderTopColor: 'var(--gold)',
                  }}
                />
              </div>
            )}
            <div ref={loadMoreRef} className="h-10" />
          </div>

          {/* ─── Colonne droite — calendrier sorties ───────────────── */}
          <aside
            style={{
              position: 'sticky',
              top: 90,
              padding: 22,
              background: 'linear-gradient(160deg,var(--panel),var(--bg-elev))',
              border: '1px solid var(--border)',
              clipPath: CUT_CARD,
            }}
            className="max-2xl:!static"
          >
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: 'italic',
                fontSize: 11,
                letterSpacing: '0.3em',
                color: 'var(--gold)',
                textTransform: 'uppercase',
              }}
            >
              — Prochaines sorties —
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text)',
              }}
            >
              Calendrier TCG
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              Fenêtre 90 j · source YGOProDeck
            </div>

            <div
              style={{
                marginTop: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {releasesLoading && (
                <>
                  {[0, 1, 2].map((k) => (
                    <div
                      key={k}
                      style={{
                        height: 60,
                        background:
                          'linear-gradient(90deg,var(--panel-2) 0%,var(--panel-3) 50%,var(--panel-2) 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'san-shimmer 1.5s linear infinite',
                        clipPath: CUT_SM,
                      }}
                    />
                  ))}
                </>
              )}
              {!releasesLoading && releases.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  Aucune sortie prévue dans les 90 prochains jours.
                </p>
              )}
              {releases.map((r) => (
                <ReleaseRow key={r.set_code} release={r} />
              ))}
            </div>
          </aside>
        </div>
      </div>

      <TopicsModal
        open={modalOpen}
        topics={topics}
        onClose={() => setModalOpen(false)}
        onSaved={(next) => setTopics(next)}
      />
    </div>
  );
};

// ─── Skeleton fil ────────────────────────────────────────────────────────
const ArticleSkeletons = () => (
  <>
    {[0, 1, 2, 3].map((k) => (
      <div
        key={k}
        style={{
          display: 'flex',
          gap: 18,
          padding: 18,
          background: 'linear-gradient(135deg,var(--panel),var(--panel-2))',
          border: '1px solid var(--border)',
          clipPath: CUT_CARD,
        }}
      >
        <div
          style={{
            width: 180,
            height: 140,
            background:
              'linear-gradient(90deg,var(--panel-2) 0%,var(--panel-3) 50%,var(--panel-2) 100%)',
            backgroundSize: '200% 100%',
            animation: 'san-shimmer 1.5s linear infinite',
            flex: '0 0 180px',
          }}
          className="max-md:!hidden"
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ height: 12, width: '30%', background: 'var(--panel-2)' }} />
          <div style={{ height: 20, width: '80%', background: 'var(--panel-2)' }} />
          <div style={{ height: 14, width: '100%', background: 'var(--panel-2)' }} />
          <div style={{ height: 14, width: '90%', background: 'var(--panel-2)' }} />
        </div>
      </div>
    ))}
  </>
);

// ─── Carte article ───────────────────────────────────────────────────────
const ArticleCard = ({ item }: { item: NewsItem }) => {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        gap: 18,
        padding: 18,
        background: 'linear-gradient(135deg,#1A1510,#14100A)',
        border: `1px solid ${hover ? 'var(--gold)' : 'var(--border)'}`,
        color: 'inherit',
        textDecoration: 'none',
        clipPath: CUT_CARD,
        transform: hover ? 'translateY(-3px)' : 'none',
        boxShadow: hover
          ? '0 20px 40px rgba(0,0,0,.55),0 0 30px rgba(245,197,24,.14)'
          : 'none',
        transition:
          'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
      }}
      className="max-md:!flex-col"
    >
      {item.image_url ? (
        <img
          src={item.image_url}
          alt=""
          loading="lazy"
          onError={(e) => {
            // Certaines images sont hotlinkées et échouent — on cache
            // silencieusement plutôt que de laisser un carré cassé.
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
          style={{
            width: 180,
            height: 140,
            objectFit: 'cover',
            border: '1px solid var(--border)',
            flex: '0 0 180px',
            background: 'var(--bg-elev)',
          }}
          className="max-md:!w-full max-md:!h-[180px] max-md:!flex-none"
        />
      ) : null}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Meta row : source · date · topics */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          <span
            style={{
              padding: '2px 8px',
              background: 'rgba(245,197,24,.12)',
              color: 'var(--gold)',
              border: '1px solid rgba(245,197,24,.35)',
              fontWeight: 700,
            }}
          >
            {item.source.name}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>{relative(item.published_at)}</span>
          {item.topics.slice(0, 3).map((t) => {
            const style = TOPIC_STYLE[t];
            if (!style) return null;
            return (
              <span
                key={t}
                style={{
                  padding: '2px 8px',
                  background: 'transparent',
                  color: style.color,
                  border: `1px solid ${style.color}`,
                  fontWeight: 600,
                }}
              >
                {style.label}
              </span>
            );
          })}
        </div>

        <h3
          style={{
            margin: 0,
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.25,
            color: 'var(--text)',
          }}
        >
          {item.title}
        </h3>

        {item.summary && (
          <p
            style={{
              margin: 0,
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: 14,
              lineHeight: 1.5,
              color: 'var(--text-muted)',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.summary}
          </p>
        )}

        <div
          style={{
            marginTop: 'auto',
            paddingTop: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: 11,
              color: 'var(--text-dim)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {item.lang?.toUpperCase() || 'EN'}
          </span>
          <span
            style={{
              color: 'var(--gold)',
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Lire →
          </span>
        </div>
      </div>
    </a>
  );
};

// ─── Ligne calendrier ────────────────────────────────────────────────────
const ReleaseRow = ({ release }: { release: NewsRelease }) => {
  const { day, month, full } = formatReleaseDate(release.tcg_date);
  // Lien YGOProDeck : la page du set. Utile même si on n'a pas de détail chez
  // nous — l'utilisateur voit la liste des cartes officielle.
  const href = `https://ygoprodeck.com/set/?search=${encodeURIComponent(release.set_name)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={full}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 14px',
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--gold)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background .15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(245,197,24,.06)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-elev)';
      }}
    >
      <div style={{ textAlign: 'center', minWidth: 46 }}>
        <div
          style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--gold)',
            lineHeight: 1,
          }}
        >
          {day}
        </div>
        <div
          style={{
            marginTop: 2,
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 9,
            letterSpacing: '0.12em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
          }}
        >
          {month}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {release.set_name}
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: '0.06em',
          }}
        >
          {release.set_code} · {release.num_of_cards} cartes
        </div>
      </div>
    </a>
  );
};

// ─── Empty state ─────────────────────────────────────────────────────────
const EmptyState = ({
  hasFilter,
  onClearFilter,
}: {
  hasFilter: boolean;
  onClearFilter: () => void;
}) => (
  <div
    style={{
      padding: '60px 20px',
      textAlign: 'center',
      background: 'linear-gradient(135deg,var(--panel),var(--panel-2))',
      border: '1px solid var(--border)',
      clipPath: CUT_CARD,
    }}
  >
    <div
      style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontStyle: 'italic',
        fontSize: 11,
        letterSpacing: '0.3em',
        color: 'var(--gold)',
        textTransform: 'uppercase',
      }}
    >
      — Rien à afficher —
    </div>
    <p
      style={{
        marginTop: 10,
        color: 'var(--text-muted)',
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: 15,
      }}
    >
      {hasFilter
        ? 'Aucun article pour ce thème pour le moment.'
        : 'Le fil est vide — la première ingestion n\'a pas encore rempli la table.'}
    </p>
    {hasFilter && (
      <button
        onClick={onClearFilter}
        style={{
          marginTop: 16,
          color: 'var(--gold)',
          background: 'transparent',
          border: 0,
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 12,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Voir tout le fil
      </button>
    )}
  </div>
);

export default News;
