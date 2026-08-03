import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDebounce } from '../hooks/useDebounce';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { Deck, Card, DeckCard, UserCard, CollectionFilters } from '../../../shared/types';
import api from '../services/api';
import toast from 'react-hot-toast';
import AppNavbar from '../components/AppNavbar';
import AppBackground from '../components/decor/AppBackground';
import CornerOrnaments from '../components/decor/CornerOrnaments';
import { GlyphEye } from '../components/decor/Glyphs';
import { SearchIcon, CardIcon, AddIcon } from '../components/decor/Icons';

interface AISuggestion {
  cardName: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}
interface AISelectedCard {
  cardId: number;
  cardName: string;
  quantity: number;
  isExtraDeck: boolean;
  reason: string;
}

interface DeckCardWithCollection extends DeckCard {
  setCode?: string;
  rarity?: string;
  collectionQuantity?: number;
}

const EXTRA_DECK_TYPES = ['Fusion Monster', 'Synchro Monster', 'XYZ Monster', 'Link Monster'];

const CUT_BTN = 'polygon(0 0,100% 0,100% 100%,95% 100%,95% 90%,85% 90%,85% 100%,8% 100%,0 70%)';
const CUT_SM = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';
const CUT_PANEL = 'polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px))';

/**
 * DeckEditor — pixel-perfect `isEditor` (DesktopFrame l.354-425).
 * Header : kicker « Atelier », h1, CTA violet « Compléter par l'IA » + primary « Sceller le deck ».
 * Grid 1fr/420px : gauche = search + chips + pool grid 5 cols avec bouton +,
 * droite sticky = row 3 compteurs Main/Extra/Side, grid 8 cols de 40 slots, tip bar cyan.
 * Toute la logique métier (add, remove, validation banlist, AI build, share) préservée.
 */
const DeckEditor = () => {
  const { deckId } = useParams<{ deckId?: string }>();
  const navigate = useNavigate();
  const isEditing = !!deckId;

  const [deckName, setDeckName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [respectBanlist, setRespectBanlist] = useState(true);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const [mainDeck, setMainDeck] = useState<DeckCardWithCollection[]>([]);
  const [extraDeck, setExtraDeck] = useState<DeckCardWithCollection[]>([]);
  const [sideDeckSize] = useState(0); // À venir — pas de side_deck côté API pour l'instant

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [searching, setSearching] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 400);

  const [chipFilter, setChipFilter] = useState<string | null>(null);
  // Filtre "Disponibles" : n'affiche que les cartes qui ont encore au moins
  // 1 exemplaire ajoutable (available - deja_dans_ce_deck > 0). Actif par
  // defaut pour eviter d'afficher les 300 cartes non-ajoutables.
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [poolCards, setPoolCards] = useState<UserCard[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolPage, setPoolPage] = useState(1);
  const [poolHasMore, setPoolHasMore] = useState(true);
  const [selectedCardDetail, setSelectedCardDetail] = useState<UserCard | null>(null);

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  // Disponibilite par carte : { [cards.id]: { owned, used_in_decks, available } }
  // `available` = possede toutes editions confondues MOINS utilise dans les autres decks.
  // Le deck en cours est exclu du calcul back (?exclude_deck=id).
  const [availability, setAvailability] = useState<Record<number, { owned: number; used_in_decks: number; available: number }>>({});
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [aiExplanation, setAiExplanation] = useState<string>('');

  const loadMoreRef = useInfiniteScroll({
    loading: poolLoading,
    hasMore: poolHasMore,
    onLoadMore: () => setPoolPage((p) => p + 1),
  });

  useEffect(() => {
    if (isEditing && deckId) fetchDeck();
  }, [deckId]);

  useEffect(() => {
    if (debouncedSearch) searchCards();
    else setSearchResults([]);
  }, [debouncedSearch]);

  useEffect(() => {
    setPoolPage(1);
    setPoolCards([]);
    setPoolHasMore(true);
    fetchPool(1, true);
  }, [chipFilter, debouncedSearch, onlyAvailable]);

  useEffect(() => {
    if (poolPage > 1) fetchPool(poolPage, false);
  }, [poolPage]);

  useEffect(() => {
    validateDeck();
  }, [mainDeck, extraDeck, respectBanlist]);

  /**
   * Charge la disponibilite (owned - used dans autres decks).
   * Refresh optimistic :
   *   - PENDANT l'edition, le badge "restant/possede" bouge en temps reel via
   *     getRemaining() = availability.available - getInDeckCount() ; nul besoin
   *     de refetch tant qu'on modifie mainDeck/extraDeck local.
   *   - Refetch necessaire APRES un save (les autres decks sont potentiellement
   *     impactes cote back) ou apres un build IA (add en masse).
   */
  const refreshAvailability = useCallback(async () => {
    const params = deckId ? { exclude_deck: deckId } : {};
    try {
      const r = await api.get('/collection/availability', { params });
      setAvailability(r.data || {});
    } catch {
      /* silencieux : perte de badge = pas bloquant */
    }
  }, [deckId]);

  useEffect(() => {
    refreshAvailability();
  }, [refreshAvailability]);

  const fetchDeck = async () => {
    try {
      const response = await api.get(`/decks/${deckId}`);
      const deck: Deck = response.data.deck;
      setDeckName(deck.name);
      setIsPublic(deck.is_public);
      setRespectBanlist(deck.respect_banlist);
      const dedupe = (cards: DeckCard[]): DeckCardWithCollection[] => {
        const m = new Map<string, DeckCardWithCollection>();
        for (const c of cards || []) {
          const key = c.card?.name || `card_${c.card_id}`;
          const ex = m.get(key);
          if (ex) ex.quantity = Math.min(3, ex.quantity + c.quantity);
          else m.set(key, { ...c } as DeckCardWithCollection);
        }
        return Array.from(m.values());
      };
      setMainDeck(dedupe(deck.main_deck || []));
      setExtraDeck(dedupe(deck.extra_deck || []));
    } catch (error) {
      console.error(error);
      toast.error('Impossible de charger le deck');
      navigate('/decks');
    } finally {
      setLoading(false);
    }
  };

  const searchCards = async () => {
    setSearching(true);
    try {
      const response = await api.get('/collection/cards', {
        params: { search: debouncedSearch, limit: 20 },
      });
      const userCards = response.data.data || response.data;
      setSearchResults(userCards.map((uc: UserCard) => uc.card!).filter(Boolean));
    } catch (error) {
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const fetchPool = async (page: number, reset: boolean) => {
    setPoolLoading(true);
    try {
      // Quand "Disponibles" est actif, on tire large (200) pour eviter les
      // pages presque vides une fois le filtre front applique. La collection
      // typique fait quelques centaines de cartes uniques.
      const params: CollectionFilters = {
        page,
        limit: onlyAvailable ? 200 : 24,
        search: debouncedSearch || undefined,
      };
      if (chipFilter === 'Monstres') params.type = 'Effect Monster';
      if (chipFilter === 'Magies') params.type = 'Spell Card';
      if (chipFilter === 'Pièges') params.type = 'Trap Card';
      const response = await api.get('/collection/cards', { params });
      const { data, total_pages } = response.data;
      if (reset) setPoolCards(data);
      else setPoolCards((prev) => [...prev, ...data]);
      setPoolHasMore(page < total_pages);
    } catch (error) {
      console.error(error);
    } finally {
      setPoolLoading(false);
    }
  };

  const getCardCountByName = useCallback(
    (name: string): number => {
      return [...mainDeck, ...extraDeck]
        .filter((dc) => dc.card?.name === name)
        .reduce((s, dc) => s + dc.quantity, 0);
    },
    [mainDeck, extraDeck]
  );

  /** Combien de fois cette carte est deja dans le deck en cours (toutes copies confondues). */
  const getInDeckCount = useCallback(
    (cardDbId: number): number =>
      [...mainDeck, ...extraDeck].filter((dc) => dc.card_id === cardDbId).reduce((s, dc) => s + dc.quantity, 0),
    [mainDeck, extraDeck]
  );

  /**
   * Combien de copies restent AJOUTABLES pour cette carte dans ce deck.
   * = available (owned - used ailleurs) - deja_dans_ce_deck.
   * Retourne 0 si la carte n'est pas dans availability (pas de donnee = pas possede).
   */
  const getRemaining = useCallback(
    (cardDbId: number): number => {
      const a = availability[cardDbId];
      if (!a) return 0;
      return Math.max(0, a.available - getInDeckCount(cardDbId));
    },
    [availability, getInDeckCount]
  );

  const validateDeck = async () => {
    const errs: string[] = [];
    const mainCount = mainDeck.reduce((s, c) => s + c.quantity, 0);
    const extraCount = extraDeck.reduce((s, c) => s + c.quantity, 0);
    if (mainCount < 40) errs.push(`Main : au moins 40 cartes (actuellement ${mainCount})`);
    if (mainCount > 60) errs.push(`Main : pas plus de 60 (actuellement ${mainCount})`);
    if (extraCount > 15) errs.push(`Extra : max 15 (actuellement ${extraCount})`);
    const counts = new Map<string, number>();
    [...mainDeck, ...extraDeck].forEach((dc) => {
      const n = dc.card?.name || '';
      if (n) counts.set(n, (counts.get(n) || 0) + dc.quantity);
    });
    counts.forEach((c, n) => {
      if (c > 3) errs.push(`Max 3 copies de « ${n} » (actuellement ${c})`);
    });
    if (respectBanlist && isEditing && deckId) {
      try {
        const response = await api.get(`/decks/${deckId}/validate`);
        if (response.data.violations?.length) {
          response.data.violations.forEach((v: any) =>
            errs.push(`Banlist : ${v.card_name} (${v.status})`)
          );
        }
      } catch {
        /* endpoint optionnel */
      }
    }
    setValidationErrors(errs);
  };

  const isExtra = (card: Card): boolean => EXTRA_DECK_TYPES.includes(card.type);

  const addCard = (card: Card, userCard?: UserCard) => {
    const ex = isExtra(card);
    const target = ex ? extraDeck : mainDeck;
    const setTarget = ex ? setExtraDeck : setMainDeck;
    const cur = target.reduce((s, d) => s + d.quantity, 0);
    const maxSize = ex ? 15 : 60;
    if (cur >= maxSize) {
      toast.error(`${ex ? 'Extra' : 'Main'} deck plein (${maxSize})`);
      return;
    }
    const cnt = getCardCountByName(card.name);
    if (cnt >= 3) {
      toast.error(`Déjà 3 copies de « ${card.name} »`);
      return;
    }
    // Blocage collection : on ne peut pas mettre plus d'exemplaires que
    // ce que la collection contient (moins ceux deja dans d'autres decks).
    const rem = getRemaining(card.id);
    if (rem <= 0) {
      const a = availability[card.id];
      const detail = a
        ? `${a.owned} possédé${a.owned > 1 ? 's' : ''}, ${a.used_in_decks} déjà dans d'autres decks`
        : 'pas dans ta collection';
      toast.error(`Plus d'exemplaires de « ${card.name} » (${detail})`);
      return;
    }
    const existing = target.find((dc) => dc.card_id === card.id);
    if (existing) {
      setTarget(target.map((dc) => (dc.card_id === card.id ? { ...dc, quantity: dc.quantity + 1 } : dc)));
    } else {
      const nd: DeckCardWithCollection = {
        id: userCard?.id || Date.now(),
        deck_id: parseInt(deckId || '0'),
        card_id: card.id,
        quantity: 1,
        is_extra_deck: ex,
        created_at: new Date(),
        card,
        setCode: userCard?.set_code,
        rarity: userCard?.rarity,
        collectionQuantity: userCard?.quantity,
      };
      setTarget([...target, nd]);
    }
    toast.success(`${card.name} ajouté`);
  };

  const decrementCard = (dcId: number, ex: boolean) => {
    const target = ex ? extraDeck : mainDeck;
    const setTarget = ex ? setExtraDeck : setMainDeck;
    setTarget(
      target
        .map((dc) => (dc.id === dcId ? { ...dc, quantity: dc.quantity - 1 } : dc))
        .filter((dc) => dc.quantity > 0) as DeckCardWithCollection[]
    );
  };

  const handleAIBuild = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Décris ton deck');
      return;
    }
    setAiLoading(true);
    try {
      const existingMain = mainDeck.length > 0
        ? mainDeck.map((dc) => ({ cardId: dc.card_id, cardName: dc.card?.name || '', quantity: dc.quantity }))
        : undefined;
      const existingExtra = extraDeck.length > 0
        ? extraDeck.map((dc) => ({ cardId: dc.card_id, cardName: dc.card?.name || '', quantity: dc.quantity }))
        : undefined;
      const response = await api.post('/decks/ai/build', {
        prompt: aiPrompt,
        existingMainDeck: existingMain,
        existingExtraDeck: existingExtra,
      });
      const { selectedCards, suggestions, explanation } = response.data;
      const mainM = new Map<string, DeckCardWithCollection>();
      const extraM = new Map<string, DeckCardWithCollection>();
      for (const sel of selectedCards as AISelectedCard[]) {
        if (!sel.quantity || sel.quantity <= 0) continue;
        const key = sel.cardName;
        const map = sel.isExtraDeck ? extraM : mainM;
        const ex = map.get(key);
        if (ex) ex.quantity = Math.min(3, ex.quantity + sel.quantity);
        else {
          try {
            const cardResp = await api.get('/collection/cards', {
              params: { card_id: sel.cardId, limit: 1 },
            });
            const ucs = cardResp.data.data || cardResp.data;
            if (ucs && ucs.length > 0) {
              const uc = ucs[0];
              const q = Math.min(sel.quantity, 3);
              if (q <= 0) continue;
              map.set(key, {
                id: Date.now() + Math.random(),
                deck_id: parseInt(deckId || '0'),
                card_id: sel.cardId,
                quantity: q,
                is_extra_deck: sel.isExtraDeck,
                created_at: new Date(),
                card: uc.card,
                setCode: uc.set_code,
                rarity: uc.rarity,
                collectionQuantity: uc.quantity,
              });
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
      setMainDeck(Array.from(mainM.values()));
      setExtraDeck(Array.from(extraM.values()));
      setAiSuggestions(suggestions || []);
      setAiExplanation(explanation || '');
      setShowAIModal(false);
      setAiPrompt('');
      toast.success('Deck généré par l’IA');
      // L'IA peut piocher des cartes qu'on n'a pas encore ajoutees a d'autres
      // decks — refresh pour recalibrer les badges "restant" du pool.
      refreshAvailability();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur IA');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!deckName.trim()) {
      toast.error('Nomme ton deck');
      return;
    }
    if (validationErrors.length > 0) {
      toast.error('Corrige les erreurs de validation');
      return;
    }
    setSaving(true);
    try {
      let savedDeckId = deckId;
      if (isEditing) {
        await api.put(`/decks/${deckId}`, {
          name: deckName,
          is_public: isPublic,
          respect_banlist: respectBanlist,
        });
      } else {
        const resp = await api.post('/decks', {
          name: deckName,
          is_public: isPublic,
          respect_banlist: respectBanlist,
        });
        savedDeckId = resp.data.deck.id.toString();
      }
      if (savedDeckId) {
        await api.delete(`/decks/${savedDeckId}/cards`);
        const map = new Map<string, { card_id: number; quantity: number; is_extra_deck: boolean }>();
        const all = [
          ...mainDeck.map((d) => ({ ...d, is_extra_deck: false })),
          ...extraDeck.map((d) => ({ ...d, is_extra_deck: true })),
        ];
        for (const dc of all) {
          const k = `${dc.card_id}-${dc.is_extra_deck}`;
          const ex = map.get(k);
          if (ex) ex.quantity += dc.quantity;
          else map.set(k, { card_id: dc.card_id, quantity: dc.quantity, is_extra_deck: dc.is_extra_deck });
        }
        for (const cd of map.values()) {
          await api.post(`/decks/${savedDeckId}/cards`, cd);
        }
      }
      toast.success(isEditing ? 'Deck mis à jour' : 'Deck scellé');
      navigate('/decks');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Sauvegarde impossible');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
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

  const mainCount = mainDeck.reduce((s, c) => s + c.quantity, 0);
  const extraCount = extraDeck.reduce((s, c) => s + c.quantity, 0);
  const chips: Array<string> = ['Monstres', 'Magies', 'Pièges'];
  const counters = [
    { label: 'Main', value: `${mainCount}/40`, bg: 'rgba(245,197,24,.1)', bord: 'rgba(245,197,24,.45)', color: 'var(--gold)' },
    { label: 'Extra', value: `${extraCount}/15`, bg: 'rgba(168,85,247,.1)', bord: 'rgba(168,85,247,.45)', color: 'var(--violet-soft)' },
    { label: 'Side', value: `${sideDeckSize}/15`, bg: 'rgba(34,211,238,.08)', bord: 'rgba(34,211,238,.4)', color: 'var(--cyan)' },
  ];

  // 40 slots grid
  const slots: Array<{ dc: DeckCardWithCollection } | null> = Array.from({ length: 40 }, (_, i) => {
    let cursor = 0;
    for (const dc of mainDeck) {
      if (i >= cursor && i < cursor + dc.quantity) {
        return { dc };
      }
      cursor += dc.quantity;
    }
    return null;
  });

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: 'var(--bg)' }}>
      <AppBackground />
      <CornerOrnaments />
      <AppNavbar />

      <div style={{ position: 'relative', zIndex: 20, padding: '32px 40px 50px', maxWidth: 1440, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
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
              — Atelier —
            </div>
            <h1
              style={{
                margin: '6px 0 0',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 34,
                fontWeight: 900,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                color: 'var(--text)',
              }}>
              {isEditing ? deckName || 'Modifier le deck' : 'Nouveau deck'}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowAIModal(true)}
              style={{
                height: 46,
                padding: '0 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                border: '1px solid var(--violet)',
                background: 'rgba(168,85,247,.12)',
                color: 'var(--violet-soft)',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                clipPath: CUT_SM,
              }}>
              Compléter par l'IA
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || validationErrors.length > 0}
              style={{
                height: 48,
                padding: '0 26px',
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
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving || validationErrors.length > 0 ? 0.5 : 1,
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
              {saving ? 'Sauvegarde...' : 'Sceller le deck'}
            </button>
          </div>
        </div>

        {/* Nom + toggles */}
        <div style={{ marginTop: 18, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="Nom du deck"
            style={{
              flex: '1 1 260px',
              height: 44,
              padding: '0 16px',
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderLeft: '3px solid var(--gold)',
              color: 'var(--text)',
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: 15,
              outline: 'none',
            }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Public
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
            <input type="checkbox" checked={respectBanlist} onChange={(e) => setRespectBanlist(e.target.checked)} />
            Respecter la banlist
          </label>
        </div>

        {validationErrors.length > 0 && (
          <div
            style={{
              marginTop: 12,
              padding: 14,
              background: 'rgba(255,77,109,.08)',
              border: '1px solid rgba(255,77,109,.4)',
              color: 'var(--danger)',
              fontSize: 13,
            }}>
            {validationErrors.map((e, i) => (
              <div key={i}>• {e}</div>
            ))}
          </div>
        )}

        {/* Grid 1fr/420 */}
        <div
          style={{
            marginTop: 24,
            display: 'grid',
            gridTemplateColumns: '1fr 420px',
            gap: 26,
            alignItems: 'start',
          }}
          className="max-xl:!grid-cols-1">
          {/* GAUCHE : search + chips + pool */}
          <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px', position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--gold)',
                    pointerEvents: 'none',
                  }}>
                  <SearchIcon size={16} />
                </div>
                <input
                  placeholder="Filtrer ma collection…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    height: 46,
                    padding: '0 16px 0 42px',
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderLeft: '3px solid var(--gold)',
                    color: 'var(--text)',
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: 15,
                    outline: 'none',
                  }}
                />
              </div>
              {/* Chip "Disponibles" — actif par defaut, filtre les cartes
                  dont il ne reste plus d'exemplaires ajoutables au deck. */}
              <button
                onClick={() => setOnlyAvailable((v) => !v)}
                title={onlyAvailable ? 'Cliquer pour voir toutes les cartes' : 'Cliquer pour cacher les cartes non-ajoutables'}
                style={{
                  height: 46,
                  padding: '0 16px',
                  border: `1px solid ${onlyAvailable ? 'var(--gold)' : 'var(--border)'}`,
                  background: onlyAvailable ? 'linear-gradient(135deg,var(--gold),var(--gold-dim))' : 'var(--panel)',
                  color: onlyAvailable ? 'var(--bg)' : 'var(--text-muted)',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontWeight: onlyAvailable ? 700 : 500,
                  boxShadow: onlyAvailable ? '0 0 12px rgba(245,197,24,.35)' : 'none',
                }}>
                {onlyAvailable ? '✓ Disponibles' : 'Disponibles'}
              </button>

              {chips.map((c) => {
                const on = chipFilter === c;
                return (
                  <button
                    key={c}
                    onClick={() => setChipFilter(on ? null : c)}
                    style={{
                      height: 46,
                      padding: '0 16px',
                      border: `1px solid ${on ? 'var(--gold)' : 'var(--border)'}`,
                      background: on ? 'rgba(245,197,24,.1)' : 'var(--panel)',
                      color: on ? 'var(--gold)' : 'var(--text-muted)',
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}>
                    {c}
                  </button>
                );
              })}
            </div>

            {/* Pool grid 5 cols */}
            <div
              style={{
                marginTop: 20,
                display: 'grid',
                gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                gap: 18,
              }}
              className="max-lg:!grid-cols-4 max-sm:!grid-cols-3">
              {poolCards
                .filter((uc) => {
                  if (!onlyAvailable) return true;
                  return uc.card?.id ? getRemaining(uc.card.id) > 0 : false;
                })
                .map((uc) => {
                const cardDbId = uc.card?.id;
                const avail = cardDbId ? availability[cardDbId] : undefined;
                const rem = cardDbId ? getRemaining(cardDbId) : 0;
                const owned = avail?.owned ?? uc.quantity ?? 0;
                const canAdd = rem > 0;
                return (
                <div
                  key={uc.id}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'transform 240ms cubic-bezier(.2,.8,.2,1)',
                    opacity: canAdd ? 1 : 0.55,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-6px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                  onClick={() => setSelectedCardDetail(uc)}>
                  <div
                    style={{
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'grid',
                      placeItems: 'center',
                      width: '100%',
                      aspectRatio: '59 / 86',
                      background: 'linear-gradient(135deg,var(--panel-2),var(--bg-elev))',
                      border: '1px solid var(--border)',
                      clipPath: 'polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)',
                    }}>
                    {uc.card?.card_images?.[0]?.image_url_small ? (
                      <img
                        src={uc.card.card_images[0].image_url_small}
                        alt={uc.card.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <CardIcon size={40} className="text-blue-600" />
                    )}

                    {/* Badge disponibles/possedes (top-left) */}
                    <div
                      title={
                        avail
                          ? `${avail.owned} possédé${avail.owned > 1 ? 's' : ''}, ${avail.used_in_decks} dans d'autres decks, ${rem} restant${rem > 1 ? 's' : ''} pour ce deck`
                          : 'Disponibilité inconnue'
                      }
                      style={{
                        position: 'absolute',
                        top: 7,
                        left: 7,
                        padding: '3px 7px',
                        background: canAdd ? 'rgba(11,9,6,.92)' : 'rgba(180,20,40,.85)',
                        border: `1px solid ${canAdd ? 'var(--gold)' : 'var(--magenta)'}`,
                        color: canAdd ? 'var(--gold)' : 'var(--text)',
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: 10,
                        letterSpacing: '0.08em',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        clipPath: 'polygon(3px 0,100% 0,100% calc(100% - 3px),calc(100% - 3px) 100%,0 100%,0 3px)',
                      }}>
                      {rem}/{owned}
                    </div>

                    <button
                      disabled={!canAdd}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (uc.card) addCard(uc.card, uc);
                      }}
                      style={{
                        position: 'absolute',
                        bottom: 7,
                        right: 7,
                        width: 28,
                        height: 28,
                        border: `1px solid ${canAdd ? 'var(--gold)' : 'var(--border)'}`,
                        background: canAdd ? 'rgba(11,9,6,.9)' : 'rgba(58,46,28,.5)',
                        color: canAdd ? 'var(--gold)' : 'var(--text-dim)',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: canAdd ? 'pointer' : 'not-allowed',
                        clipPath: 'polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)',
                      }}
                      aria-label={canAdd ? 'Ajouter' : 'Plus d\'exemplaires disponibles'}>
                      <AddIcon size={14} />
                    </button>
                  </div>
                  <div
                    style={{
                      marginTop: 7,
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                    {uc.card?.name}
                  </div>
                </div>
                );
              })}

              {/* Message si tout filtre : aucune carte ajoutable */}
              {!poolLoading &&
                onlyAvailable &&
                poolCards.length > 0 &&
                poolCards.filter((uc) => uc.card?.id && getRemaining(uc.card.id) > 0).length === 0 && (
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      padding: '40px 20px',
                      textAlign: 'center',
                      background: 'linear-gradient(135deg,var(--panel),var(--bg-elev))',
                      border: '1px dashed var(--border)',
                      color: 'var(--text-muted)',
                      fontSize: 13,
                      fontFamily: "'Rajdhani', sans-serif",
                    }}>
                    Toutes tes cartes disponibles sont déjà dans ce deck ou dans d'autres.
                    <br />
                    <button
                      onClick={() => setOnlyAvailable(false)}
                      style={{
                        marginTop: 12,
                        padding: '8px 18px',
                        border: '1px solid var(--gold)',
                        background: 'transparent',
                        color: 'var(--gold)',
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: 10,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}>
                      Voir toutes les cartes
                    </button>
                  </div>
                )}
            </div>
            {poolLoading && (
              <div className="text-center py-6">
                <div
                  className="inline-block animate-spin"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: '2px solid rgba(245,197,24,.3)',
                    borderTopColor: 'var(--gold)',
                  }}
                />
              </div>
            )}
            <div ref={loadMoreRef} className="h-8" />
          </div>

          {/* DROITE : sticky panel counters + 40 slots + tip */}
          <div
            style={{
              position: 'sticky',
              top: 84,
              padding: 22,
              background: 'linear-gradient(150deg,var(--panel),var(--bg-sunken))',
              border: '1px solid var(--border)',
              clipPath: CUT_PANEL,
            }}
            className="max-xl:!static">
            <div style={{ display: 'flex', gap: 8 }}>
              {counters.map((k) => (
                <div
                  key={k.label}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    background: k.bg,
                    border: `1px solid ${k.bord}`,
                    color: k.color,
                    clipPath: CUT_SM,
                  }}>
                  <span
                    style={{
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 9,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      opacity: 0.8,
                    }}>
                    {k.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 17,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                    {k.value}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--gold)',
                }}>
                Deck principal
              </span>
              <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border),transparent)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>clic = retirer</span>
            </div>

            {/* 40 slots grid 8 cols */}
            <div
              style={{
                marginTop: 12,
                display: 'grid',
                gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                gap: 6,
              }}>
              {slots.map((s, i) => {
                const filled = !!s;
                return (
                  <div
                    key={i}
                    onClick={() => {
                      if (s?.dc) decrementCard(s.dc.id, false);
                    }}
                    style={{
                      aspectRatio: '59 / 86',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: filled ? 'pointer' : 'default',
                      background: filled
                        ? 'linear-gradient(150deg,var(--border-soft),var(--bg-elev))'
                        : 'rgba(255,255,255,.015)',
                      border: filled
                        ? '1px solid rgba(245,197,24,.4)'
                        : '1px dashed rgba(245,197,24,.2)',
                      overflow: 'hidden',
                    }}>
                    {filled && s?.dc.card?.card_images?.[0]?.image_url_small ? (
                      <img
                        src={s.dc.card.card_images[0].image_url_small}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : filled ? (
                      <CardIcon size={16} className="text-blue-600" />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Tip bar cyan */}
            <div
              style={{
                marginTop: 18,
                padding: '12px 14px',
                background: 'rgba(34,211,238,.06)',
                border: '1px solid rgba(34,211,238,.35)',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}>
              <GlyphEye style={{ width: 16, height: 16, color: 'var(--cyan)', flex: 'none', marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                Ratio conseillé : 22 monstres / 12 magies / 6 pièges. Tu es à {mainCount} cartes.
              </p>
            </div>

            {/* Extra deck compact */}
            {extraDeck.length > 0 && (
              <>
                <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 10,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: 'var(--violet-soft)',
                    }}>
                    Extra deck
                  </span>
                  <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border),transparent)' }} />
                </div>
                <div
                  style={{
                    marginTop: 8,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                    gap: 6,
                  }}>
                  {extraDeck.map((dc) =>
                    Array.from({ length: dc.quantity }, (_, k) => (
                      <div
                        key={`${dc.id}-${k}`}
                        onClick={() => decrementCard(dc.id, true)}
                        style={{
                          aspectRatio: '59 / 86',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                          background: 'linear-gradient(150deg,var(--border-soft),var(--bg-elev))',
                          border: '1px solid rgba(168,85,247,.4)',
                          overflow: 'hidden',
                        }}>
                        {dc.card?.card_images?.[0]?.image_url_small ? (
                          <img
                            src={dc.card.card_images[0].image_url_small}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <CardIcon size={14} style={{ color: 'var(--violet-soft)' }} />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* AI suggestions inline */}
            {(aiSuggestions.length > 0 || aiExplanation) && (
              <div
                style={{
                  marginTop: 18,
                  padding: 14,
                  background: 'rgba(168,85,247,.06)',
                  border: '1px solid rgba(168,85,247,.35)',
                }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 10,
                  }}>
                  <span
                    style={{
                      fontFamily: "'Orbitron', sans-serif",
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--violet-soft)',
                    }}>
                    Suggestions IA
                  </span>
                  <button
                    onClick={() => {
                      setAiSuggestions([]);
                      setAiExplanation('');
                    }}
                    style={{ background: 'transparent', border: 0, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>
                    ×
                  </button>
                </div>
                {aiExplanation && <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-muted)' }}>{aiExplanation}</p>}
                {aiSuggestions.map((s, i) => (
                  <div key={i} style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                    • <span style={{ color: 'var(--text)' }}>{s.cardName}</span> — {s.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search results rapides (dropdown-like) */}
        {searchResults.length > 0 && (
          <div
            style={{
              marginTop: 20,
              padding: 16,
              background: 'linear-gradient(150deg,var(--panel),var(--bg-sunken))',
              border: '1px solid var(--border)',
              clipPath: CUT_PANEL,
            }}>
            <div
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 11,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--gold)',
                marginBottom: 10,
              }}>
              Résultats rapides
            </div>
            {searching && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Recherche…</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {searchResults.map((c) => {
                const cnt = getCardCountByName(c.name);
                const can = cnt < 3;
                return (
                  <div
                    key={c.id}
                    onClick={() => can && addCard(c)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 10px',
                      background: 'var(--bg-elev)',
                      border: '1px solid var(--border)',
                      cursor: can ? 'pointer' : 'not-allowed',
                      opacity: can ? 1 : 0.4,
                    }}>
                    {c.card_images?.[0]?.image_url_small && (
                      <img src={c.card_images[0].image_url_small} alt="" style={{ width: 32 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: 12,
                          color: 'var(--text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.type}</div>
                    </div>
                    <span style={{ color: 'var(--gold)', fontSize: 11 }}>{cnt}/3</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* AI modal */}
      {showAIModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3,2,1,.86)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
            padding: 20,
          }}
          onClick={() => setShowAIModal(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              padding: 32,
              background: 'linear-gradient(160deg,var(--panel),var(--bg))',
              border: '1px solid var(--border)',
              clipPath: 'polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,22px 100%,0 calc(100% - 22px))',
            }}>
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: 'italic',
                fontSize: 11,
                letterSpacing: '0.3em',
                color: 'var(--gold)',
                textTransform: 'uppercase',
              }}>
              — Oracle IA —
            </div>
            <h2
              style={{
                margin: '6px 0 16px',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 24,
                fontWeight: 900,
                letterSpacing: '0.02em',
                color: 'var(--text)',
                textTransform: 'uppercase',
              }}>
              Décris ton deck
            </h2>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ex : Un deck Dragons Blancs aux Yeux Bleus, agressif, avec fusions..."
              style={{
                width: '100%',
                minHeight: 120,
                padding: 14,
                background: 'var(--bg-elev)',
                border: '1px solid var(--border)',
                borderLeft: '2px solid var(--violet)',
                color: 'var(--text)',
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: 14,
                outline: 'none',
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setShowAIModal(false)}
                style={{
                  flex: 1,
                  height: 44,
                  background: 'var(--bg-elev)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  clipPath: CUT_SM,
                }}>
                Annuler
              </button>
              <button
                onClick={handleAIBuild}
                disabled={aiLoading}
                style={{
                  flex: 1,
                  height: 44,
                  background: 'var(--violet)',
                  color: '#fff',
                  border: 0,
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  cursor: aiLoading ? 'not-allowed' : 'pointer',
                  opacity: aiLoading ? 0.6 : 1,
                  clipPath: CUT_SM,
                }}>
                {aiLoading ? 'Génération...' : 'Générer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card detail modal (light) */}
      {selectedCardDetail?.card && (
        <div
          onClick={() => setSelectedCardDetail(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3,2,1,.86)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
            padding: 40,
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              gap: 40,
              maxWidth: 800,
              flexWrap: 'wrap',
              alignItems: 'flex-start',
            }}>
            {selectedCardDetail.card.card_images?.[0]?.image_url && (
              <img
                src={selectedCardDetail.card.card_images[0].image_url}
                alt=""
                style={{
                  width: 280,
                  border: '1px solid var(--gold)',
                  boxShadow: '0 40px 90px rgba(0,0,0,.75),0 0 60px rgba(245,197,24,.25)',
                }}
              />
            )}
            <div style={{ maxWidth: 380, color: 'var(--text)' }}>
              <div
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 22,
                  fontWeight: 900,
                  color: 'var(--text)',
                }}>
                {selectedCardDetail.card.name}
              </div>
              <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                {selectedCardDetail.set_code} · {selectedCardDetail.rarity}
              </div>
              {selectedCardDetail.card.description && (
                <p style={{ marginTop: 14, fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                  {selectedCardDetail.card.description.slice(0, 400)}
                  {selectedCardDetail.card.description.length > 400 ? '...' : ''}
                </p>
              )}
              <button
                onClick={() => {
                  if (selectedCardDetail.card) addCard(selectedCardDetail.card, selectedCardDetail);
                  setSelectedCardDetail(null);
                }}
                style={{
                  marginTop: 16,
                  padding: '10px 18px',
                  background: 'var(--gold)',
                  color: 'var(--bg)',
                  border: 0,
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  clipPath: CUT_SM,
                }}>
                Ajouter au deck
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeckEditor;
