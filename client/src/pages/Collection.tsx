import { useState, useEffect, FormEvent } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { UserCard, CollectionFilters, Card, CardLanguage } from '../../../shared/types';
import api from '../services/api';
import toast from 'react-hot-toast';
import AppNavbar from '../components/AppNavbar';
import AppBackground from '../components/decor/AppBackground';
import CornerOrnaments from '../components/decor/CornerOrnaments';
import CardTile from '../components/decor/CardTile';
import { GlyphPyramid } from '../components/decor/Glyphs';
import { SearchIcon, ScanIcon, AddIcon } from '../components/decor/Icons';

interface CardSet {
  set_name: string;
  set_code: string;
  set_rarity: string;
  set_rarity_code?: string;
  set_price?: string;
}

const LANGUAGE_LABELS: Record<CardLanguage, string> = {
  EN: 'Anglais',
  FR: 'Français',
  DE: 'Allemand',
  IT: 'Italien',
  PT: 'Portugais',
  SP: 'Espagnol',
  JP: 'Japonais',
  KR: 'Coréen',
};

const CUT_BTN = 'polygon(0 0,100% 0,100% 100%,95% 100%,95% 90%,85% 90%,85% 100%,8% 100%,0 70%)';
const CUT_SM = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';
const CUT_STATS = 'polygon(0 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,14px 100%,0 calc(100% - 14px))';
const CUT_CHIP = 'polygon(0 0,calc(100% - 8px) 0,100% 100%,8px 100%)';
const CUT_INPUT = 'polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)';

const CHIPS = [
  { label: 'Toutes', filter: {} },
  { label: 'Monstres', filter: { type: 'Effect Monster' } },
  { label: 'Magies', filter: { type: 'Spell Card' } },
  { label: 'Pièges', filter: { type: 'Trap Card' } },
  { label: 'Extra Deck', filter: { type: 'Fusion Monster' } },
  { label: 'Récentes', filter: {} },
  { label: 'Ultra rares ↑', filter: { rarity: 'Ultra Rare' } },
];

/**
 * Collection — pixel-perfect `isCollection` (DesktopFrame l.147-209).
 * Header kicker or + h1 54px dégradé, 4 stats bar biseautée, search+CTA+Scanner,
 * chips scroll, grid de card-tiles avec halo au sol.
 */
const Collection = () => {
  const [cards, setCards] = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCards, setTotalCards] = useState(0);
  const [uniqueCards, setUniqueCards] = useState(0);

  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [rarity, setRarity] = useState('');
  const [chipIdx, setChipIdx] = useState(0);
  const debouncedSearch = useDebounce(search, 500);

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchCode, setSearchCode] = useState('');
  const [searchedCard, setSearchedCard] = useState<Card | null>(null);
  const [availableSets, setAvailableSets] = useState<CardSet[]>([]);
  const [selectedSet, setSelectedSet] = useState('');
  const [selectedRarity, setSelectedRarity] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<CardLanguage>('EN');
  const [quantity, setQuantity] = useState(1);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedCardDetail, setSelectedCardDetail] = useState<UserCard | null>(null);

  const loadMoreRef = useInfiniteScroll({
    loading,
    hasMore,
    onLoadMore: () => setPage((prev) => prev + 1),
  });

  useEffect(() => {
    fetchCards(page);
  }, [page, debouncedSearch, type, rarity]);

  const fetchCards = async (pageNum: number) => {
    setLoading(true);
    try {
      const params: CollectionFilters = {
        page: pageNum,
        limit: 24,
        search: debouncedSearch || undefined,
        type: type || undefined,
        rarity: rarity || undefined,
      };
      const response = await api.get('/collection/cards', { params });
      const { data, total, total_pages } = response.data;
      if (pageNum === 1) setCards(data);
      else setCards((prev) => [...prev, ...data]);
      setTotalCards(total);
      setUniqueCards(response.data.unique_count ?? data.length);
      setHasMore(pageNum < total_pages);
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyChip = (i: number) => {
    setChipIdx(i);
    const f = CHIPS[i].filter as any;
    setType(f.type || '');
    setRarity(f.rarity || '');
    setPage(1);
    setCards([]);
    setHasMore(true);
  };

  const handleSearchCard = async () => {
    if (!searchCode.trim()) {
      setSearchError('Entrez un ID de carte ou un Code Set');
      return;
    }
    setSearchLoading(true);
    setSearchError('');
    setSearchedCard(null);
    setAvailableSets([]);
    setSelectedSet('');
    setSelectedRarity('');
    setSelectedLanguage('EN');
    try {
      const response = await api.get('/collection/search', {
        params: { code: searchCode.trim() },
      });
      const { card, matchedSet, availableSets: sets, detectedLanguage, originalSetCode } = response.data;
      setSearchedCard(card);
      setAvailableSets(sets || []);
      if (detectedLanguage) setSelectedLanguage(detectedLanguage as CardLanguage);
      if (originalSetCode && matchedSet) {
        setSelectedSet(originalSetCode);
        setSelectedRarity(matchedSet.set_rarity);
      } else if (matchedSet) {
        setSelectedSet(matchedSet.set_code);
        setSelectedRarity(matchedSet.set_rarity);
      } else if (sets && sets.length === 1) {
        setSelectedSet(sets[0].set_code);
        setSelectedRarity(sets[0].set_rarity);
      }
    } catch (error: any) {
      setSearchError(error.response?.data?.message || 'Carte non trouvée');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddCard = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchedCard || !selectedSet || !selectedRarity) {
      toast.error('Recherche une carte et choisis set + rareté');
      return;
    }
    try {
      await api.post('/collection/cards/add', {
        card_code: searchedCard.card_id,
        set_code: selectedSet,
        rarity: selectedRarity,
        language: selectedLanguage,
        quantity,
      });
      toast.success(`Carte ajoutée (${LANGUAGE_LABELS[selectedLanguage]})`);
      resetAddModal();
      setPage(1);
      fetchCards(1);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Échec de l'ajout");
    }
  };

  const resetAddModal = () => {
    setShowAddModal(false);
    setSearchCode('');
    setSearchedCard(null);
    setAvailableSets([]);
    setSelectedSet('');
    setSelectedRarity('');
    setSelectedLanguage('EN');
    setQuantity(1);
    setSearchError('');
  };

  const handleRemoveCard = async (cardId: number) => {
    if (!confirm('Retirer cette carte de la collection ?')) return;
    try {
      await api.delete(`/collection/cards/${cardId}`);
      toast.success('Carte retirée');
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      setTotalCards((prev) => prev - 1);
    } catch (error) {
      console.error(error);
    }
  };

  const stats = [
    {
      label: 'Cartes totales',
      value: totalCards.toLocaleString('fr-FR'),
      trend: '— À venir',
      accent: '#F5C518',
    },
    {
      label: 'Cartes uniques',
      value: uniqueCards.toLocaleString('fr-FR'),
      trend: '',
      accent: '#F5EFE0',
    },
    {
      label: 'Ultra rares +',
      value: '— À venir',
      trend: '',
      accent: '#F5EFE0',
    },
    {
      label: 'Valeur estimée',
      value: '— À venir',
      trend: '',
      accent: '#F5EFE0',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: '#0B0906' }}>
      <AppBackground />
      <CornerOrnaments />
      <AppNavbar />

      <div style={{ position: 'relative', zIndex: 20, padding: '46px 40px 60px', maxWidth: 1440, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ position: 'relative', paddingBottom: 30, borderBottom: '1px solid #3A2E1C' }}>
          <GlyphPyramid
            style={{ position: 'absolute', right: 0, top: -16, width: 150, height: 150, color: '#F5C518', opacity: 0.07 }}
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
            — Vitrine du Millénium —
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
              filter: 'drop-shadow(0 0 18px rgba(245,197,24,.16))',
            }}>
            Ma Collection
          </h1>
          <p style={{ margin: '14px 0 0', maxWidth: 560, fontSize: 17, lineHeight: 1.5, color: '#A99C86' }}>
            {totalCards > 0
              ? `${totalCards.toLocaleString('fr-FR')} cartes rassemblées, cataloguées, prêtes à être invoquées. Ton grimoire vivant de duelliste.`
              : 'Ta vitrine est vide. Scanne, ajoute, catalogue.'}
          </p>

          {/* 4 stats biseautée */}
          <div
            style={{
              marginTop: 26,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 1,
              background: '#3A2E1C',
              border: '1px solid #3A2E1C',
              clipPath: CUT_STATS,
            }}
            className="max-md:!grid-cols-2">
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  padding: '18px 22px',
                  background: 'linear-gradient(135deg,#1A1510,#221B12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 3,
                    height: '100%',
                    background: '#F5C518',
                    opacity: 0.55,
                  }}
                />
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
                    fontSize: 30,
                    fontWeight: 700,
                    color: s.accent,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}>
                  {s.value}
                </span>
                {s.trend && (
                  <span style={{ fontSize: 12, color: '#6E6250', letterSpacing: '0.04em' }}>{s.trend}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Barre search + CTA */}
        <div style={{ marginTop: 28, display: 'flex', gap: 14, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', position: 'relative', minWidth: 240 }}>
            <SearchIcon
              size={18}
              className="absolute"
            />
            <div
              style={{
                position: 'absolute',
                left: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#F5C518',
                pointerEvents: 'none',
              }}>
              <SearchIcon size={18} />
            </div>
            <input
              placeholder="Cherche par nom, effet, archétype…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                setCards([]);
                setHasMore(true);
              }}
              style={{
                width: '100%',
                height: 52,
                padding: '0 18px 0 46px',
                background: '#1A1510',
                border: '1px solid #3A2E1C',
                borderLeft: '3px solid #F5C518',
                color: '#F5EFE0',
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: 16,
                outline: 'none',
                clipPath: CUT_INPUT,
              }}
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            style={{
              height: 52,
              padding: '0 26px',
              position: 'relative',
              isolation: 'isolate',
              border: 0,
              background: 'transparent',
              color: '#0B0906',
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 9,
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
            <AddIcon size={14} />
            Ajouter
          </button>

          <button
            onClick={() =>
              toast('Scanner arrive bientôt sur web — utilise l’app mobile', { icon: '⏳' })
            }
            style={{
              height: 52,
              padding: '0 24px',
              border: '1px solid #A855F7',
              background: 'rgba(168,85,247,.12)',
              color: '#C084FC',
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              clipPath: CUT_SM,
            }}>
            <ScanIcon size={15} />
            Scanner
          </button>
        </div>

        {/* Chips */}
        <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CHIPS.map((c, i) => {
            const on = chipIdx === i;
            return (
              <button
                key={c.label}
                onClick={() => applyChip(i)}
                style={{
                  padding: '9px 17px',
                  border: `1px solid ${on ? '#F5C518' : '#3A2E1C'}`,
                  background: on ? 'linear-gradient(135deg,#F5C518,#C29A0F)' : '#1A1510',
                  color: on ? '#0B0906' : '#A99C86',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontWeight: on ? 700 : 500,
                  clipPath: CUT_CHIP,
                  boxShadow: on ? '0 0 12px rgba(245,197,24,.35)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Cards grid 6 cols */}
        <div
          style={{
            marginTop: 30,
            display: 'grid',
            gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
            gap: 22,
          }}
          className="max-2xl:!grid-cols-5 max-xl:!grid-cols-4 max-lg:!grid-cols-3 max-sm:!grid-cols-2">
          {cards.map((userCard, i) => (
            <CardTile
              key={userCard.id}
              uri={userCard.card?.card_images?.[0]?.image_url_small}
              name={userCard.card?.name}
              rarity={userCard.rarity}
              quantity={userCard.quantity}
              language={userCard.language}
              setCode={userCard.set_code}
              index={i}
              onClick={() => setSelectedCardDetail(userCard)}
            />
          ))}
        </div>

        {loading && (
          <div className="text-center py-8">
            <div
              className="inline-block animate-spin"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: '3px solid rgba(245,197,24,.3)',
                borderTopColor: '#F5C518',
              }}
            />
          </div>
        )}
        <div ref={loadMoreRef} className="h-10" />

        {!loading && cards.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: '#A99C86', fontSize: 16 }}>Aucune carte dans votre grimoire.</p>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                marginTop: 16,
                color: '#F5C518',
                background: 'transparent',
                border: 0,
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 12,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 700,
                cursor: 'pointer',
              }}>
              Ajouter la première carte
            </button>
          </div>
        )}
      </div>

      {/* Modal Add — kept structurally but restyled */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3,2,1,.86)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
          onClick={resetAddModal}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(160deg,#1A1510,#0D0A06)',
              border: '1px solid #3A2E1C',
              boxShadow: '0 40px 80px rgba(0,0,0,.6),0 0 60px rgba(245,197,24,.08)',
              padding: 32,
              maxWidth: 520,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              clipPath: 'polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,20px 100%,0 calc(100% - 20px))',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#F5EFE0',
                }}>
                Ajouter une carte
              </div>
              <button
                onClick={resetAddModal}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: '#A99C86',
                  fontSize: 24,
                  cursor: 'pointer',
                }}>
                ×
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: '#A99C86',
                  marginBottom: 6,
                }}>
                Code Set ou ID
              </label>
              <p style={{ color: '#6E6250', fontSize: 12, marginBottom: 8 }}>
                Ex : LDK2-FRK40 (sous l'illustration) ou 46986414 (bas gauche).
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchCard()}
                  placeholder="LDK2-FRK40"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    background: '#14100A',
                    border: '1px solid #3A2E1C',
                    borderLeft: '2px solid #F5C518',
                    color: '#F5EFE0',
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSearchCard}
                  disabled={searchLoading}
                  style={{
                    padding: '0 16px',
                    background: '#F5C518',
                    color: '#0B0906',
                    border: 0,
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    clipPath: CUT_SM,
                  }}>
                  {searchLoading ? '...' : 'Chercher'}
                </button>
              </div>
              {searchError && (
                <p style={{ color: '#FF4D6D', fontSize: 12, marginTop: 8 }}>{searchError}</p>
              )}
            </div>

            {searchedCard && (
              <div
                style={{
                  padding: 12,
                  background: '#14100A',
                  border: '1px solid #3A2E1C',
                  display: 'flex',
                  gap: 12,
                  marginBottom: 20,
                }}>
                {searchedCard.card_images?.[0]?.image_url_small && (
                  <img
                    src={searchedCard.card_images[0].image_url_small}
                    alt={searchedCard.name}
                    style={{ width: 60, height: 'auto' }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#F5EFE0',
                    }}>
                    {searchedCard.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#A99C86', marginTop: 4 }}>{searchedCard.type}</div>
                </div>
              </div>
            )}

            {searchedCard && (
              <form onSubmit={handleAddCard} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="text"
                  value={selectedSet}
                  onChange={(e) => setSelectedSet(e.target.value.toUpperCase())}
                  placeholder="Code Set"
                  style={{
                    padding: '10px 14px',
                    background: '#14100A',
                    border: '1px solid #3A2E1C',
                    borderLeft: '2px solid #F5C518',
                    color: '#F5EFE0',
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                {availableSets.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedSet(e.target.value);
                        const setInfo = availableSets.find((s) => s.set_code === e.target.value);
                        if (setInfo) setSelectedRarity(setInfo.set_rarity);
                      }
                    }}
                    style={{
                      padding: '10px 14px',
                      background: '#14100A',
                      border: '1px solid #3A2E1C',
                      color: '#F5EFE0',
                      fontFamily: "'Rajdhani', sans-serif",
                      fontSize: 13,
                    }}>
                    <option value="">— Sets disponibles ({availableSets.length}) —</option>
                    {availableSets.map((s) => (
                      <option key={s.set_code} value={s.set_code}>
                        {s.set_code} — {s.set_name} ({s.set_rarity})
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={selectedRarity}
                  onChange={(e) => setSelectedRarity(e.target.value)}
                  style={{
                    padding: '10px 14px',
                    background: '#14100A',
                    border: '1px solid #3A2E1C',
                    color: '#F5EFE0',
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: 14,
                  }}>
                  <option value="">Rareté</option>
                  {[
                    'Common', 'Rare', 'Super Rare', 'Ultra Rare', 'Secret Rare',
                    'Ultimate Rare', 'Ghost Rare', 'Starlight Rare', "Collector's Rare",
                  ].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value as CardLanguage)}
                  style={{
                    padding: '10px 14px',
                    background: '#14100A',
                    border: '1px solid #3A2E1C',
                    color: '#F5EFE0',
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: 14,
                  }}>
                  {(Object.keys(LANGUAGE_LABELS) as CardLanguage[]).map((l) => (
                    <option key={l} value={l}>{LANGUAGE_LABELS[l]} ({l})</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  min={1}
                  placeholder="Quantité"
                  style={{
                    padding: '10px 14px',
                    background: '#14100A',
                    border: '1px solid #3A2E1C',
                    color: '#F5EFE0',
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: 14,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={resetAddModal}
                    style={{
                      flex: 1,
                      height: 44,
                      background: '#14100A',
                      color: '#A99C86',
                      border: '1px solid #3A2E1C',
                      fontFamily: "'Orbitron', sans-serif",
                      fontWeight: 600,
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
                    disabled={!selectedSet || !selectedRarity}
                    style={{
                      flex: 1,
                      height: 44,
                      background: '#F5C518',
                      color: '#0B0906',
                      border: 0,
                      fontFamily: "'Orbitron', sans-serif",
                      fontWeight: 700,
                      fontSize: 11,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      clipPath: CUT_SM,
                    }}>
                    Ajouter
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Card Detail — allégée */}
      {selectedCardDetail && selectedCardDetail.card && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3,2,1,.86)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 46,
            padding: 60,
            zIndex: 100,
          }}
          onClick={() => setSelectedCardDetail(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              gap: 46,
              maxWidth: 900,
              flexWrap: 'wrap',
            }}>
            {selectedCardDetail.card.card_images?.[0]?.image_url && (
              <img
                src={selectedCardDetail.card.card_images[0].image_url}
                alt={selectedCardDetail.card.name}
                style={{
                  width: 330,
                  height: 'auto',
                  border: '1px solid #F5C518',
                  boxShadow: '0 40px 90px rgba(0,0,0,.75),0 0 60px rgba(245,197,24,.25)',
                }}
              />
            )}
            <div style={{ maxWidth: 420, color: '#F5EFE0' }}>
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: 'italic',
                  fontSize: 11,
                  letterSpacing: '0.3em',
                  color: '#F5C518',
                  textTransform: 'uppercase',
                }}>
                — {selectedCardDetail.rarity} —
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 30,
                  fontWeight: 900,
                  letterSpacing: '0.02em',
                  color: '#F5EFE0',
                  lineHeight: 1.05,
                }}>
                {selectedCardDetail.card.name}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#A99C86',
                }}>
                {selectedCardDetail.set_code} · {selectedCardDetail.card.type}
              </div>
              {(selectedCardDetail.card.atk !== undefined || selectedCardDetail.card.def !== undefined) && (
                <div style={{ marginTop: 22, display: 'flex', gap: 26, fontSize: 13 }}>
                  {selectedCardDetail.card.atk !== undefined && (
                    <span style={{ color: '#A99C86' }}>ATK <span style={{ color: '#F5EFE0' }}>{selectedCardDetail.card.atk}</span></span>
                  )}
                  {selectedCardDetail.card.def !== undefined && (
                    <span style={{ color: '#A99C86' }}>DEF <span style={{ color: '#F5EFE0' }}>{selectedCardDetail.card.def}</span></span>
                  )}
                  {selectedCardDetail.card.level !== undefined && (
                    <span style={{ color: '#A99C86' }}>NIV <span style={{ color: '#F5EFE0' }}>{selectedCardDetail.card.level}</span></span>
                  )}
                </div>
              )}
              {selectedCardDetail.card.description && (
                <p style={{ marginTop: 22, fontSize: 14, lineHeight: 1.6, color: '#A99C86' }}>
                  {selectedCardDetail.card.description}
                </p>
              )}
              <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                <button
                  onClick={() => {
                    handleRemoveCard(selectedCardDetail.id);
                    setSelectedCardDetail(null);
                  }}
                  style={{
                    padding: '10px 16px',
                    background: 'transparent',
                    border: '1px solid #FF4D6D',
                    color: '#FF4D6D',
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    clipPath: CUT_SM,
                  }}>
                  Retirer
                </button>
                <button
                  onClick={() => setSelectedCardDetail(null)}
                  style={{
                    padding: '10px 16px',
                    background: '#F5C518',
                    color: '#0B0906',
                    border: 0,
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    clipPath: CUT_SM,
                  }}>
                  Fermer
                </button>
              </div>
              <div
                style={{
                  marginTop: 24,
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: 12,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'rgba(245,239,224,.4)',
                }}>
                Clique n'importe où pour refermer
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Collection;
