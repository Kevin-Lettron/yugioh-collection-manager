import { useState, useEffect, FormEvent, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { Deck, Card, DeckCard, UserCard, CollectionFilters, CardLanguage } from '../../../shared/types';
import api from '../services/api';
import toast from 'react-hot-toast';
import AppNavbar from '../components/AppNavbar';

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

interface CardSelection {
  card: Card;
  quantity: number;
  isExtra: boolean;
  userCardId: number; // Unique ID from collection (specific to set_code + rarity)
  setCode: string;
  rarity: string;
  collectionQuantity: number; // How many of this edition the user owns
}

// Extended DeckCard with collection info for local state
interface DeckCardWithCollection extends DeckCard {
  setCode?: string;
  rarity?: string;
  collectionQuantity?: number;
}

const DeckEditor = () => {
  const { deckId } = useParams<{ deckId?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEditing = !!deckId;

  // Deck info
  const [deckName, setDeckName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [respectBanlist, setRespectBanlist] = useState(true);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  // Deck cards (with collection info for display)
  const [mainDeck, setMainDeck] = useState<DeckCardWithCollection[]>([]);
  const [extraDeck, setExtraDeck] = useState<DeckCardWithCollection[]>([]);

  // Quick search (name or setcode)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [searching, setSearching] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 500);

  // Collection modal
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionModalType, setCollectionModalType] = useState<'main' | 'extra'>('main');
  const [collectionCards, setCollectionCards] = useState<UserCard[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionPage, setCollectionPage] = useState(1);
  const [collectionHasMore, setCollectionHasMore] = useState(true);
  const [selectedCards, setSelectedCards] = useState<Map<number, CardSelection>>(new Map());

  // Collection filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAttribute, setFilterAttribute] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const debouncedFilterSearch = useDebounce(filterSearch, 500);

  // Validation
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Share modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  // Card detail modal
  const [selectedCardDetail, setSelectedCardDetail] = useState<UserCard | null>(null);

  // Infinite scroll for collection modal
  const loadMoreRef = useInfiniteScroll({
    loading: collectionLoading,
    hasMore: collectionHasMore,
    onLoadMore: () => setCollectionPage((prev) => prev + 1),
  });

  useEffect(() => {
    if (isEditing && deckId) {
      fetchDeck();
    }
  }, [deckId]);

  useEffect(() => {
    if (debouncedSearch) {
      searchCards();
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    validateDeck();
  }, [mainDeck, extraDeck, respectBanlist]);

  // Fetch collection when modal opens or filters change
  useEffect(() => {
    if (showCollectionModal) {
      setCollectionPage(1);
      setCollectionCards([]);
      setCollectionHasMore(true);
      fetchCollectionCards(1, true);
    }
  }, [showCollectionModal, collectionModalType, debouncedFilterSearch, filterType, filterAttribute, filterRarity]);

  // Load more collection cards
  useEffect(() => {
    if (showCollectionModal && collectionPage > 1) {
      fetchCollectionCards(collectionPage, false);
    }
  }, [collectionPage]);

  const fetchDeck = async () => {
    try {
      const response = await api.get(`/decks/${deckId}`);
      const deck: Deck = response.data.deck;

      setDeckName(deck.name);
      setIsPublic(deck.is_public);
      setRespectBanlist(deck.respect_banlist);
      setMainDeck(deck.main_deck || []);
      setExtraDeck(deck.extra_deck || []);
    } catch (error) {
      console.error('Failed to fetch deck:', error);
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
      console.error('Failed to search cards:', error);
    } finally {
      setSearching(false);
    }
  };

  // Extra deck card types
  const EXTRA_DECK_TYPES = ['Fusion Monster', 'Synchro Monster', 'XYZ Monster', 'Link Monster'];

  const fetchCollectionCards = async (page: number, reset: boolean) => {
    setCollectionLoading(true);
    try {
      const params: CollectionFilters = {
        page,
        limit: 50, // Increased limit to ensure all card editions are loaded
        search: debouncedFilterSearch || undefined,
        type: filterType || undefined,
        attribute: filterAttribute || undefined,
        rarity: filterRarity || undefined,
      };

      const response = await api.get('/collection/cards', { params });
      let { data, total_pages } = response.data;

      // Filter cards based on modal type (main deck or extra deck)
      if (collectionModalType === 'main') {
        // Main deck: exclude extra deck monsters
        data = data.filter((uc: UserCard) => !uc.card || !EXTRA_DECK_TYPES.includes(uc.card.type));
      } else {
        // Extra deck: only extra deck monsters
        data = data.filter((uc: UserCard) => uc.card && EXTRA_DECK_TYPES.includes(uc.card.type));
      }

      if (reset) {
        setCollectionCards(data);
      } else {
        setCollectionCards((prev) => [...prev, ...data]);
      }

      setCollectionHasMore(page < total_pages);
    } catch (error) {
      console.error('Failed to fetch collection:', error);
    } finally {
      setCollectionLoading(false);
    }
  };

  // Count cards by NAME in the deck
  const getCardCountByName = useCallback((cardName: string): number => {
    const allCards = [...mainDeck, ...extraDeck];
    return allCards
      .filter((dc) => dc.card?.name === cardName)
      .reduce((sum, dc) => sum + dc.quantity, 0);
  }, [mainDeck, extraDeck]);

  // Count selected cards by NAME
  const getSelectedCountByName = useCallback((cardName: string): number => {
    let count = 0;
    selectedCards.forEach((selection) => {
      if (selection.card.name === cardName) {
        count += selection.quantity;
      }
    });
    return count;
  }, [selectedCards]);

  // Get total count for a card name (deck + selection)
  const getTotalCountByName = useCallback((cardName: string): number => {
    return getCardCountByName(cardName) + getSelectedCountByName(cardName);
  }, [getCardCountByName, getSelectedCountByName]);

  // Get quantity of a specific edition (by userCardId) already in the deck
  const getEditionCountInDeck = useCallback((userCardId: number): number => {
    const allCards = [...mainDeck, ...extraDeck];
    const deckCard = allCards.find((dc) => dc.id === userCardId);
    return deckCard?.quantity || 0;
  }, [mainDeck, extraDeck]);

  const validateDeck = async () => {
    const errors: string[] = [];
    const mainCount = mainDeck.reduce((sum, card) => sum + card.quantity, 0);
    const extraCount = extraDeck.reduce((sum, card) => sum + card.quantity, 0);

    // Main deck validation
    if (mainCount < 40) {
      errors.push(`Le deck principal doit contenir au moins 40 cartes (actuellement ${mainCount})`);
    }
    if (mainCount > 60) {
      errors.push(`Le deck principal ne peut pas dépasser 60 cartes (actuellement ${mainCount})`);
    }

    // Extra deck validation
    if (extraCount > 15) {
      errors.push(`L'Extra Deck ne peut pas dépasser 15 cartes (actuellement ${extraCount})`);
    }

    // Check for duplicate violations (max 3 of same card NAME)
    const allCards = [...mainDeck, ...extraDeck];
    const cardCountsByName = new Map<string, number>();

    allCards.forEach((deckCard) => {
      const cardName = deckCard.card?.name || '';
      if (cardName) {
        const current = cardCountsByName.get(cardName) || 0;
        cardCountsByName.set(cardName, current + deckCard.quantity);
      }
    });

    cardCountsByName.forEach((count, cardName) => {
      if (count > 3) {
        errors.push(`Vous ne pouvez pas avoir plus de 3 copies de "${cardName}" (actuellement ${count})`);
      }
    });

    // Banlist validation (if enabled)
    if (respectBanlist && isEditing && deckId) {
      try {
        const response = await api.get(`/decks/${deckId}/validate`);
        if (response.data.violations && response.data.violations.length > 0) {
          response.data.violations.forEach((violation: any) => {
            errors.push(`Violation de la banlist : ${violation.card_name} (${violation.status})`);
          });
        }
      } catch (error) {
        // Validation endpoint might not be available yet
      }
    }

    setValidationErrors(errors);
  };

  const isExtraCard = (card: Card): boolean => {
    const extraTypes = ['Fusion Monster', 'Synchro Monster', 'XYZ Monster', 'Link Monster'];
    return extraTypes.includes(card.type);
  };

  const addCardToDeck = (card: Card, quantity: number = 1) => {
    const isExtra = isExtraCard(card);
    const targetDeck = isExtra ? extraDeck : mainDeck;
    const setTargetDeck = isExtra ? setExtraDeck : setMainDeck;

    // Check deck size limits (60 for main, 15 for extra)
    const currentDeckCount = targetDeck.reduce((sum, dc) => sum + dc.quantity, 0);
    const maxDeckSize = isExtra ? 15 : 60;
    const remainingSpace = maxDeckSize - currentDeckCount;

    if (remainingSpace <= 0) {
      toast.error(`Le ${isExtra ? 'Extra Deck' : 'Deck Principal'} est plein (${maxDeckSize} cartes maximum)`);
      return;
    }

    // Check limit of 3 by NAME
    const currentCount = getCardCountByName(card.name);
    const maxAddable = Math.min(3 - currentCount, remainingSpace);

    if (maxAddable <= 0) {
      toast.error(`Vous avez déjà 3 copies de "${card.name}" dans le deck`);
      return;
    }

    const actualQuantity = Math.min(quantity, maxAddable);

    // Check if card already exists in deck (by card_id for same version)
    const existingCard = targetDeck.find((dc) => dc.card_id === card.id);

    if (existingCard) {
      // Increment quantity
      setTargetDeck(
        targetDeck.map((dc) =>
          dc.card_id === card.id ? { ...dc, quantity: dc.quantity + actualQuantity } : dc
        )
      );
    } else {
      // Add new card
      const newDeckCard: DeckCard = {
        id: Date.now(),
        deck_id: parseInt(deckId || '0'),
        card_id: card.id,
        quantity: actualQuantity,
        is_extra_deck: isExtra,
        created_at: new Date(),
        card,
      };
      setTargetDeck([...targetDeck, newDeckCard]);
    }

    if (actualQuantity < quantity) {
      toast.success(`${actualQuantity}x ${card.name} ajouté (limite de 3 atteinte)`);
    } else {
      toast.success(`${actualQuantity}x ${card.name} ajouté au ${isExtra ? 'Extra Deck' : 'Deck Principal'}`);
    }
  };

  const removeCardFromDeck = (deckCardId: number, isExtra: boolean) => {
    const targetDeck = isExtra ? extraDeck : mainDeck;
    const setTargetDeck = isExtra ? setExtraDeck : setMainDeck;

    setTargetDeck(targetDeck.filter((dc) => dc.id !== deckCardId));
  };

  const updateCardQuantity = (deckCardId: number, isExtra: boolean, delta: number) => {
    const targetDeck = isExtra ? extraDeck : mainDeck;
    const setTargetDeck = isExtra ? setExtraDeck : setMainDeck;

    const deckCard = targetDeck.find((dc) => dc.id === deckCardId);
    if (!deckCard?.card) return;

    // Check limit when increasing
    if (delta > 0) {
      // Check deck size limit
      const currentDeckCount = targetDeck.reduce((sum, dc) => sum + dc.quantity, 0);
      const maxDeckSize = isExtra ? 15 : 60;
      if (currentDeckCount >= maxDeckSize) {
        toast.error(`Le ${isExtra ? 'Extra Deck' : 'Deck Principal'} est plein (${maxDeckSize} cartes maximum)`);
        return;
      }

      // Check 3 copies limit by NAME
      const currentCount = getCardCountByName(deckCard.card.name);
      if (currentCount >= 3) {
        toast.error(`Limite de 3 copies atteinte pour "${deckCard.card.name}"`);
        return;
      }
    }

    setTargetDeck(
      targetDeck
        .map((dc) => {
          if (dc.id === deckCardId) {
            const newQuantity = dc.quantity + delta;
            return newQuantity > 0 ? { ...dc, quantity: newQuantity } : null;
          }
          return dc;
        })
        .filter((dc): dc is DeckCard => dc !== null)
    );
  };

  // Get total selected count for main or extra deck
  const getSelectedDeckCount = useCallback((forExtra: boolean): number => {
    let count = 0;
    selectedCards.forEach((selection) => {
      if (selection.isExtra === forExtra) {
        count += selection.quantity;
      }
    });
    return count;
  }, [selectedCards]);

  // Collection modal selection handlers
  const handleCardSelection = (userCard: UserCard, delta: number) => {
    if (!userCard.card) return;

    const card = userCard.card;
    const userCardId = userCard.id; // Use userCard.id as key (unique per set_code + rarity)
    const isExtra = isExtraCard(card);

    const currentSelection = selectedCards.get(userCardId);
    const currentSelectedQty = currentSelection?.quantity || 0;
    const newQty = currentSelectedQty + delta;

    // Check limit of 3 by NAME (deck + selection)
    if (delta > 0) {
      // Check deck size limit (60 for main, 15 for extra)
      const currentDeckCount = isExtra
        ? extraDeck.reduce((sum, dc) => sum + dc.quantity, 0)
        : mainDeck.reduce((sum, dc) => sum + dc.quantity, 0);
      const selectedForDeck = getSelectedDeckCount(isExtra);
      const maxDeckSize = isExtra ? 15 : 60;

      if (currentDeckCount + selectedForDeck >= maxDeckSize) {
        toast.error(`Le ${isExtra ? 'Extra Deck' : 'Deck Principal'} est plein (${maxDeckSize} cartes maximum)`);
        return;
      }

      const totalCount = getTotalCountByName(card.name);
      if (totalCount >= 3) {
        toast.error(`Limite de 3 copies atteinte pour "${card.name}"`);
        return;
      }
      // Check collection quantity limit (cannot exceed what you own for this specific edition)
      // Must account for cards already in deck + currently selected
      const editionInDeck = getEditionCountInDeck(userCardId);
      const editionTotalUsed = editionInDeck + currentSelectedQty;
      if (editionTotalUsed >= userCard.quantity) {
        toast.error(`Vous n'avez que ${userCard.quantity} exemplaire(s) de cette édition dans votre collection (${editionInDeck} déjà dans le deck)`);
        return;
      }
    }

    if (newQty <= 0) {
      // Remove from selection
      const newSelection = new Map(selectedCards);
      newSelection.delete(userCardId);
      setSelectedCards(newSelection);
    } else {
      // Update selection
      const newSelection = new Map(selectedCards);
      newSelection.set(userCardId, {
        card,
        quantity: newQty,
        isExtra,
        userCardId,
        setCode: userCard.set_code,
        rarity: userCard.rarity,
        collectionQuantity: userCard.quantity,
      });
      setSelectedCards(newSelection);
    }
  };

  const handleAddSelectedCards = () => {
    // Group selections by deck type
    const mainSelections: CardSelection[] = [];
    const extraSelections: CardSelection[] = [];

    selectedCards.forEach((selection) => {
      if (selection.isExtra) {
        extraSelections.push(selection);
      } else {
        mainSelections.push(selection);
      }
    });

    // Add to main deck - each selection is a separate entry (different edition)
    if (mainSelections.length > 0) {
      setMainDeck((prevDeck) => {
        let newDeck = [...prevDeck];

        for (const selection of mainSelections) {
          // Use userCardId as unique identifier for this edition
          const existingIndex = newDeck.findIndex(
            (dc) => dc.id === selection.userCardId
          );

          if (existingIndex >= 0) {
            // Update existing entry
            newDeck[existingIndex] = {
              ...newDeck[existingIndex],
              quantity: newDeck[existingIndex].quantity + selection.quantity,
            };
          } else {
            // Add new entry for this edition with collection info
            const newDeckCard: DeckCardWithCollection = {
              id: selection.userCardId, // Use userCardId as unique ID
              deck_id: parseInt(deckId || '0'),
              card_id: selection.card.id,
              quantity: selection.quantity,
              is_extra_deck: false,
              created_at: new Date(),
              card: selection.card,
              setCode: selection.setCode,
              rarity: selection.rarity,
              collectionQuantity: selection.collectionQuantity,
            };
            newDeck.push(newDeckCard);
          }
        }

        return newDeck;
      });
    }

    // Add to extra deck - each selection is a separate entry (different edition)
    if (extraSelections.length > 0) {
      setExtraDeck((prevDeck) => {
        let newDeck = [...prevDeck];

        for (const selection of extraSelections) {
          // Use userCardId as unique identifier for this edition
          const existingIndex = newDeck.findIndex(
            (dc) => dc.id === selection.userCardId
          );

          if (existingIndex >= 0) {
            // Update existing entry
            newDeck[existingIndex] = {
              ...newDeck[existingIndex],
              quantity: newDeck[existingIndex].quantity + selection.quantity,
            };
          } else {
            // Add new entry for this edition with collection info
            const newDeckCard: DeckCardWithCollection = {
              id: selection.userCardId, // Use userCardId as unique ID
              deck_id: parseInt(deckId || '0'),
              card_id: selection.card.id,
              quantity: selection.quantity,
              is_extra_deck: true,
              created_at: new Date(),
              card: selection.card,
              setCode: selection.setCode,
              rarity: selection.rarity,
              collectionQuantity: selection.collectionQuantity,
            };
            newDeck.push(newDeckCard);
          }
        }

        return newDeck;
      });
    }

    const totalCards = Array.from(selectedCards.values()).reduce((sum, s) => sum + s.quantity, 0);
    setSelectedCards(new Map());
    setShowCollectionModal(false);
    toast.success(`${totalCards} carte(s) ajoutée(s) au deck`);
  };

  const openCollectionModal = (type: 'main' | 'extra') => {
    setCollectionModalType(type);
    setShowCollectionModal(true);
  };

  const handleGenerateShareLink = async () => {
    if (!deckId) return;

    setShareLoading(true);
    try {
      const response = await api.post(`/decks/${deckId}/share`);
      setShareToken(response.data.share_token);
      setShowShareModal(true);
    } catch (error: any) {
      console.error('Failed to generate share link:', error);
      toast.error('Erreur lors de la generation du lien de partage');
    } finally {
      setShareLoading(false);
    }
  };

  const copyShareLink = () => {
    if (!shareToken) return;
    const shareUrl = `${window.location.origin}/deck/share/${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Lien copie dans le presse-papiers !');
  };

  const resetCollectionModal = () => {
    setShowCollectionModal(false);
    setSelectedCards(new Map());
    setFilterSearch('');
    setFilterType('');
    setFilterAttribute('');
    setFilterRarity('');
    setCollectionPage(1);
    setCollectionCards([]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!deckName.trim()) {
      toast.error('Veuillez entrer un nom pour le deck');
      return;
    }

    if (validationErrors.length > 0) {
      toast.error('Veuillez corriger les erreurs de validation avant de sauvegarder');
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
        const response = await api.post('/decks', {
          name: deckName,
          is_public: isPublic,
          respect_banlist: respectBanlist,
        });
        savedDeckId = response.data.deck.id.toString();
      }

      if (savedDeckId) {
        // First, clear existing cards from the deck
        await api.delete(`/decks/${savedDeckId}/cards`);

        // Group cards by card_id and is_extra_deck to avoid duplicate entries
        const cardMap = new Map<string, { card_id: number; quantity: number; is_extra_deck: boolean }>();

        const allCards = [
          ...mainDeck.map((dc) => ({ ...dc, is_extra_deck: false })),
          ...extraDeck.map((dc) => ({ ...dc, is_extra_deck: true })),
        ];

        for (const deckCard of allCards) {
          const key = `${deckCard.card_id}-${deckCard.is_extra_deck}`;
          const existing = cardMap.get(key);
          if (existing) {
            existing.quantity += deckCard.quantity;
          } else {
            cardMap.set(key, {
              card_id: deckCard.card_id,
              quantity: deckCard.quantity,
              is_extra_deck: deckCard.is_extra_deck,
            });
          }
        }

        // Save grouped cards
        for (const cardData of cardMap.values()) {
          await api.post(`/decks/${savedDeckId}/cards`, cardData);
        }
      }

      toast.success(isEditing ? 'Deck mis à jour avec succès !' : 'Deck créé avec succès !');
      navigate('/decks');
    } catch (error: any) {
      console.error('Failed to save deck:', error);
      const message = error.response?.data?.message || 'Erreur lors de la sauvegarde du deck';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  const mainDeckCount = mainDeck.reduce((sum, card) => sum + card.quantity, 0);
  const extraDeckCount = extraDeck.reduce((sum, card) => sum + card.quantity, 0);
  const totalSelectedCount = Array.from(selectedCards.values()).reduce((sum, s) => sum + s.quantity, 0);

  // Calculate selected cards count for each deck type
  const selectedMainCount = getSelectedDeckCount(false);
  const selectedExtraCount = getSelectedDeckCount(true);

  // Check if decks are full (including selections)
  const isMainDeckFull = mainDeckCount + selectedMainCount >= 60;
  const isExtraDeckFull = extraDeckCount + selectedExtraCount >= 15;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <AppNavbar />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-800">
            {isEditing ? 'Modifier le deck' : 'Créer un nouveau deck'}
          </h2>
          {isEditing && (
            <div className="flex items-center gap-3">
              {/* View public page button */}
              <button
                onClick={() => navigate(`/decks/${deckId}`)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Voir page publique
              </button>
              {/* Share button */}
              <button
                onClick={handleGenerateShareLink}
                disabled={shareLoading}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-semibold disabled:bg-green-400"
              >
                {shareLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                )}
                Partager le deck
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Deck Settings & Search */}
          <div className="lg:col-span-1 space-y-6">
            {/* Deck Settings */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Paramètres du deck</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nom du deck</label>
                  <input
                    type="text"
                    value={deckName}
                    onChange={(e) => setDeckName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Entrez le nom du deck"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-700">
                    Rendre le deck public
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="respectBanlist"
                    checked={respectBanlist}
                    onChange={(e) => setRespectBanlist(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="respectBanlist" className="ml-2 block text-sm text-gray-700">
                    Respecter la banlist
                  </label>
                </div>

                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-red-800 mb-2">Erreurs de validation :</h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      {validationErrors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Deck Stats */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Deck Principal :</span>
                      <span className={mainDeckCount >= 40 && mainDeckCount <= 60 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {mainDeckCount} cartes / 40 à 60
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Extra Deck :</span>
                      <span className={extraDeckCount <= 15 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {extraDeckCount} cartes / 0 à 15
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => navigate('/decks')}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={saving || validationErrors.length > 0}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-blue-400 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                </div>
              </form>
            </div>

            {/* Card Search */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Ajouter des cartes</h3>

              {/* Quick search */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-4"
                placeholder="Recherche rapide (nom ou set code)..."
              />

              {/* Buttons to open collection modal */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => openCollectionModal('main')}
                  className="bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold flex flex-col items-center justify-center space-y-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="text-xs">Main Deck</span>
                </button>
                <button
                  type="button"
                  onClick={() => openCollectionModal('extra')}
                  className="bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition font-semibold flex flex-col items-center justify-center space-y-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span className="text-xs">Extra Deck</span>
                </button>
              </div>

              {/* Quick search results */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searching && (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                  </div>
                )}

                {searchResults.map((card) => {
                  const countInDeck = getCardCountByName(card.name);
                  const canAdd = countInDeck < 3;

                  return (
                    <div
                      key={card.id}
                      className={`flex items-center space-x-3 p-2 rounded-lg ${canAdd ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                      onClick={() => canAdd && addCardToDeck(card)}
                    >
                      <img
                        src={card.card_images?.[0]?.image_url_small || '/placeholder-card.png'}
                        alt={card.name}
                        className="w-12 h-auto"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-800">{card.name}</p>
                        <p className="text-xs text-gray-600">{card.type}</p>
                      </div>
                      <div className="text-xs text-gray-500">
                        {countInDeck}/3
                      </div>
                    </div>
                  );
                })}

                {!searching && searchQuery && searchResults.length === 0 && (
                  <p className="text-center text-gray-600 py-4">Aucune carte trouvée</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Deck Lists */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Deck */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Deck Principal ({mainDeckCount} cartes)
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {mainDeck.map((deckCard) => {
                  const totalInDeck = deckCard.card?.name ? getCardCountByName(deckCard.card.name) : 0;
                  return (
                    <div key={deckCard.id} className="relative group">
                      {/* Badge Total deck en haut à gauche */}
                      <div className="absolute top-1 left-1 bg-green-600 text-white text-[8px] px-1 py-0.5 rounded font-bold z-10">
                        Total deck: {totalInDeck}/3
                      </div>
                      <img
                        src={deckCard.card?.card_images?.[0]?.image_url_small || '/placeholder-card.png'}
                        alt={deckCard.card?.name}
                        className="w-full h-auto rounded shadow cursor-pointer hover:opacity-90 transition"
                        onClick={() => deckCard.card && setSelectedCardDetail({
                          id: deckCard.id,
                          user_id: 0,
                          card_id: deckCard.card_id,
                          set_code: deckCard.setCode || '',
                          rarity: deckCard.rarity || '',
                          language: 'FR' as CardLanguage,
                          quantity: deckCard.collectionQuantity || deckCard.quantity,
                          created_at: new Date(),
                          updated_at: new Date(),
                          card: deckCard.card,
                        })}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-1">
                        <p className="text-[10px] font-semibold truncate">{deckCard.card?.name}</p>
                        <div className="flex items-center justify-between mt-0.5">
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => updateCardQuantity(deckCard.id, false, -1)}
                              className="bg-red-600 hover:bg-red-700 w-4 h-4 rounded flex items-center justify-center text-[10px]"
                            >
                              -
                            </button>
                            <span className="text-[10px] font-bold">x{deckCard.quantity}</span>
                            <button
                              onClick={() => updateCardQuantity(deckCard.id, false, 1)}
                              className="bg-green-600 hover:bg-green-700 w-4 h-4 rounded flex items-center justify-center text-[10px]"
                            >
                              +
                            </button>
                          </div>
                          <button
                            onClick={() => removeCardFromDeck(deckCard.id, false)}
                            className="text-red-400 hover:text-red-300 text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                        {/* Badge Collection en bas */}
                        {deckCard.collectionQuantity && (
                          <div className="text-[8px] text-gray-300 mt-0.5">
                            Collection: x{deckCard.collectionQuantity}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {mainDeck.length === 0 && (
                <p className="text-center text-gray-600 py-8">
                  Aucune carte dans le Deck Principal. Recherchez et ajoutez des cartes depuis votre collection.
                </p>
              )}
            </div>

            {/* Extra Deck */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Extra Deck ({extraDeckCount} cartes)
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {extraDeck.map((deckCard) => {
                  const totalInDeck = deckCard.card?.name ? getCardCountByName(deckCard.card.name) : 0;
                  return (
                    <div key={deckCard.id} className="relative group">
                      {/* Badge Total deck en haut à gauche */}
                      <div className="absolute top-1 left-1 bg-purple-600 text-white text-[8px] px-1 py-0.5 rounded font-bold z-10">
                        Total deck: {totalInDeck}/3
                      </div>
                      <img
                        src={deckCard.card?.card_images?.[0]?.image_url_small || '/placeholder-card.png'}
                        alt={deckCard.card?.name}
                        className="w-full h-auto rounded shadow cursor-pointer hover:opacity-90 transition"
                        onClick={() => deckCard.card && setSelectedCardDetail({
                          id: deckCard.id,
                          user_id: 0,
                          card_id: deckCard.card_id,
                          set_code: deckCard.setCode || '',
                          rarity: deckCard.rarity || '',
                          language: 'FR' as CardLanguage,
                          quantity: deckCard.collectionQuantity || deckCard.quantity,
                          created_at: new Date(),
                          updated_at: new Date(),
                          card: deckCard.card,
                        })}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-1">
                        <p className="text-[10px] font-semibold truncate">{deckCard.card?.name}</p>
                        <div className="flex items-center justify-between mt-0.5">
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => updateCardQuantity(deckCard.id, true, -1)}
                              className="bg-red-600 hover:bg-red-700 w-4 h-4 rounded flex items-center justify-center text-[10px]"
                            >
                              -
                            </button>
                            <span className="text-[10px] font-bold">x{deckCard.quantity}</span>
                            <button
                              onClick={() => updateCardQuantity(deckCard.id, true, 1)}
                              className="bg-green-600 hover:bg-green-700 w-4 h-4 rounded flex items-center justify-center text-[10px]"
                            >
                              +
                            </button>
                          </div>
                          <button
                            onClick={() => removeCardFromDeck(deckCard.id, true)}
                            className="text-red-400 hover:text-red-300 text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                        {/* Badge Collection en bas */}
                        {deckCard.collectionQuantity && (
                          <div className="text-[8px] text-gray-300 mt-0.5">
                            Collection: x{deckCard.collectionQuantity}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {extraDeck.length === 0 && (
                <p className="text-center text-gray-600 py-8">
                  Aucune carte dans l'Extra Deck. Les monstres Fusion, Synchro, XYZ et Link vont ici.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Collection Modal */}
      {showCollectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <h3 className="text-2xl font-bold text-gray-800">
                  {collectionModalType === 'main' ? 'Ajouter au Main Deck' : 'Ajouter à l\'Extra Deck'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {collectionModalType === 'main'
                    ? 'Monstres, Magies et Pièges (pas de Fusion/Synchro/Xyz/Link)'
                    : 'Monstres Fusion, Synchro, Xyz et Link uniquement'}
                </p>
                {/* Deck count indicator */}
                <div className="mt-2">
                  {collectionModalType === 'main' ? (
                    <span className={`text-sm font-semibold ${isMainDeckFull ? 'text-red-600' : 'text-green-600'}`}>
                      Main Deck: {mainDeckCount + selectedMainCount} cartes / 40 à 60
                      {isMainDeckFull && ' (PLEIN)'}
                    </span>
                  ) : (
                    <span className={`text-sm font-semibold ${isExtraDeckFull ? 'text-red-600' : 'text-green-600'}`}>
                      Extra Deck: {extraDeckCount + selectedExtraCount} cartes / 0 à 15
                      {isExtraDeckFull && ' (PLEIN)'}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={resetCollectionModal}
                className="text-gray-500 hover:text-gray-700 text-3xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Filters */}
            <div className="p-4 bg-gray-50 border-b">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-700">Filtres</span>
                {(filterSearch || filterType || filterAttribute || filterRarity) && (
                  <button
                    onClick={() => {
                      setFilterSearch('');
                      setFilterType('');
                      setFilterAttribute('');
                      setFilterRarity('');
                    }}
                    className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reset filtres
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rechercher</label>
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="Nom de la carte..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  >
                    <option value="">Tous les types</option>
                    <option value="Effect Monster">Monstre à Effet</option>
                    <option value="Normal Monster">Monstre Normal</option>
                    <option value="Spell Card">Carte Magie</option>
                    <option value="Trap Card">Carte Piège</option>
                    <option value="Fusion Monster">Monstre Fusion</option>
                    <option value="Synchro Monster">Monstre Synchro</option>
                    <option value="XYZ Monster">Monstre Xyz</option>
                    <option value="Link Monster">Monstre Lien</option>
                    <option value="Ritual Monster">Monstre Rituel</option>
                    <option value="Pendulum Effect Monster">Monstre Pendule à Effet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attribut</label>
                  <select
                    value={filterAttribute}
                    onChange={(e) => setFilterAttribute(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  >
                    <option value="">Tous les attributs</option>
                    <option value="DARK">TÉNÈBRES</option>
                    <option value="LIGHT">LUMIÈRE</option>
                    <option value="EARTH">TERRE</option>
                    <option value="WATER">EAU</option>
                    <option value="FIRE">FEU</option>
                    <option value="WIND">VENT</option>
                    <option value="DIVINE">DIVIN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rareté</label>
                  <select
                    value={filterRarity}
                    onChange={(e) => setFilterRarity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  >
                    <option value="">Toutes les raretés</option>
                    <option value="Common">Common</option>
                    <option value="Rare">Rare</option>
                    <option value="Super Rare">Super Rare</option>
                    <option value="Ultra Rare">Ultra Rare</option>
                    <option value="Secret Rare">Secret Rare</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Cards Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {collectionCards.map((userCard) => {
                  if (!userCard.card) return null;

                  // Use userCard.id as key (unique per set_code + rarity edition)
                  const selection = selectedCards.get(userCard.id);
                  const selectedQty = selection?.quantity || 0;
                  const countInDeck = getCardCountByName(userCard.card.name);
                  const totalCount = countInDeck + getSelectedCountByName(userCard.card.name);
                  const cardIsExtra = isExtraCard(userCard.card);
                  const isDeckFull = cardIsExtra ? isExtraDeckFull : isMainDeckFull;
                  // Get how many of THIS SPECIFIC EDITION are already in the deck
                  const editionInDeck = getEditionCountInDeck(userCard.id);
                  // Total used for this edition = already in deck + currently selected
                  const editionTotalUsed = editionInDeck + selectedQty;
                  // Can add more if: 1) deck not full, 2) under 3 copies by NAME, and 3) edition total < collection quantity
                  const canAddMore = !isDeckFull && totalCount < 3 && editionTotalUsed < userCard.quantity;

                  return (
                    <div
                      key={userCard.id}
                      className={`rounded-lg overflow-hidden bg-white shadow ${selectedQty > 0 ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      {/* Card image with badges */}
                      <div className="relative">
                        <img
                          src={userCard.card.card_images?.[0]?.image_url_small || '/placeholder-card.png'}
                          alt={userCard.card.name}
                          className="w-full h-auto cursor-pointer hover:opacity-90 transition"
                          onClick={() => setSelectedCardDetail(userCard)}
                        />
                        {/* Selected badge */}
                        {selectedQty > 0 && (
                          <div className="absolute top-1 right-1 bg-blue-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                            {selectedQty}
                          </div>
                        )}
                        {/* Deck count badge (based on card NAME: deck + selection) */}
                        <div className={`absolute top-1 left-1 text-white text-[10px] font-bold px-1.5 py-0.5 rounded ${totalCount >= 3 ? 'bg-red-600' : 'bg-green-600'}`}>
                          Total deck: {totalCount}/3
                        </div>
                        {/* Collection quantity badge (specific to this set code + rarity) */}
                        <div className="absolute bottom-1 right-1 bg-gray-800 bg-opacity-80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                          Collection: x{userCard.quantity}
                        </div>
                      </div>

                      {/* Card info below image */}
                      <div className="p-2 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-800 truncate" title={userCard.card.name}>
                          {userCard.card.name}
                        </p>
                        <p className="text-[10px] text-gray-600 truncate" title={userCard.rarity}>
                          {userCard.rarity}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate" title={userCard.set_code}>
                          {userCard.set_code}
                        </p>

                        {/* Selection controls */}
                        <div className="flex items-center justify-center space-x-2 mt-2">
                          <button
                            onClick={() => handleCardSelection(userCard, -1)}
                            disabled={selectedQty === 0}
                            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed w-7 h-7 rounded flex items-center justify-center text-white text-sm font-bold"
                          >
                            -
                          </button>
                          <span className="font-bold text-sm w-6 text-center text-gray-800">{selectedQty}</span>
                          <button
                            onClick={() => handleCardSelection(userCard, 1)}
                            disabled={!canAddMore}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed w-7 h-7 rounded flex items-center justify-center text-white text-sm font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Loading indicator */}
              {collectionLoading && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                </div>
              )}

              {/* Load more trigger */}
              <div ref={loadMoreRef} className="h-10" />

              {/* Empty state */}
              {!collectionLoading && collectionCards.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-600 text-lg">Aucune carte trouvée dans votre collection.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {totalSelectedCount > 0 ? (
                  <span className="font-semibold text-blue-600">
                    {totalSelectedCount} carte(s) sélectionnée(s)
                  </span>
                ) : (
                  <span>Cliquez sur + pour sélectionner des cartes</span>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={resetCollectionModal}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddSelectedCards}
                  disabled={totalSelectedCount === 0}
                  className={`px-6 py-2 text-white rounded-lg transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed ${
                    collectionModalType === 'main'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  Ajouter au {collectionModalType === 'main' ? 'Main Deck' : 'Extra Deck'} ({totalSelectedCount})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && shareToken && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-bold text-gray-800">Partager le deck</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Partagez ce lien avec vos amis pour qu'ils puissent voir votre deck sans avoir besoin de se connecter.
              </p>

              <div className="bg-gray-100 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-500 mb-1">Lien de partage :</p>
                <p className="text-sm font-mono break-all text-blue-600">
                  {`${window.location.origin}/deck/share/${shareToken}`}
                </p>
              </div>

              <button
                onClick={copyShareLink}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copier le lien
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-gray-50 rounded-b-lg">
              <p className="text-xs text-gray-500 text-center">
                Ce lien restera actif jusqu'a ce que vous le desactiviez.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Card Detail Modal */}
      {selectedCardDetail && selectedCardDetail.card && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4"
          onClick={() => setSelectedCardDetail(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <h3 className="text-2xl font-bold text-gray-800">
                {selectedCardDetail.card.name}
              </h3>
              <button
                onClick={() => setSelectedCardDetail(null)}
                className="text-gray-500 hover:text-gray-700 text-3xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Card Image */}
                <div className="flex-shrink-0 mx-auto md:mx-0">
                  <img
                    src={selectedCardDetail.card.card_images?.[0]?.image_url || '/placeholder-card.png'}
                    alt={selectedCardDetail.card.name}
                    className="w-64 h-auto rounded-lg shadow-lg"
                  />
                </div>

                {/* Card Info */}
                <div className="flex-1 space-y-4">
                  {/* Type & Attribute Row */}
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                      {selectedCardDetail.card.type}
                    </span>
                    {selectedCardDetail.card.attribute && (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedCardDetail.card.attribute === 'DARK' ? 'bg-gray-800 text-white' :
                        selectedCardDetail.card.attribute === 'LIGHT' ? 'bg-yellow-100 text-yellow-800' :
                        selectedCardDetail.card.attribute === 'FIRE' ? 'bg-red-100 text-red-800' :
                        selectedCardDetail.card.attribute === 'WATER' ? 'bg-blue-100 text-blue-800' :
                        selectedCardDetail.card.attribute === 'EARTH' ? 'bg-amber-100 text-amber-800' :
                        selectedCardDetail.card.attribute === 'WIND' ? 'bg-green-100 text-green-800' :
                        selectedCardDetail.card.attribute === 'DIVINE' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedCardDetail.card.attribute}
                      </span>
                    )}
                    {selectedCardDetail.card.race && (
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
                        {selectedCardDetail.card.race}
                      </span>
                    )}
                  </div>

                  {/* Monster Stats */}
                  {(selectedCardDetail.card.level !== undefined ||
                    selectedCardDetail.card.linkval !== undefined ||
                    selectedCardDetail.card.atk !== undefined) && (
                    <div className="flex flex-wrap gap-4 text-sm">
                      {selectedCardDetail.card.level !== undefined && (
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-500 text-lg">★</span>
                          <span className="font-medium">Niveau {selectedCardDetail.card.level}</span>
                        </div>
                      )}
                      {selectedCardDetail.card.linkval !== undefined && (
                        <div className="flex items-center gap-1">
                          <span className="text-blue-500 font-bold">LIEN-{selectedCardDetail.card.linkval}</span>
                        </div>
                      )}
                      {selectedCardDetail.card.scale !== undefined && (
                        <div className="flex items-center gap-1">
                          <span className="text-teal-600 font-medium">Échelle : {selectedCardDetail.card.scale}</span>
                        </div>
                      )}
                      {selectedCardDetail.card.atk !== undefined && (
                        <div className="font-medium">
                          <span className="text-red-600">ATK</span> {selectedCardDetail.card.atk}
                        </div>
                      )}
                      {selectedCardDetail.card.def !== undefined && (
                        <div className="font-medium">
                          <span className="text-blue-600">DEF</span> {selectedCardDetail.card.def}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Link Markers */}
                  {selectedCardDetail.card.linkmarkers && selectedCardDetail.card.linkmarkers.length > 0 && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Flèches Lien : </span>
                      <span className="text-gray-600">
                        {selectedCardDetail.card.linkmarkers.join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Archetype */}
                  {selectedCardDetail.card.archetype && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Archétype : </span>
                      <span className="text-gray-600">{selectedCardDetail.card.archetype}</span>
                    </div>
                  )}

                  {/* Card Description/Effect */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Texte de la carte</h4>
                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedCardDetail.card.description}
                    </p>
                  </div>

                  {/* Banlist Info */}
                  {selectedCardDetail.card.banlist_info && (
                    <div className="flex flex-wrap gap-2">
                      {selectedCardDetail.card.banlist_info.ban_tcg && (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          selectedCardDetail.card.banlist_info.ban_tcg === 'Banned' ? 'bg-red-100 text-red-800' :
                          selectedCardDetail.card.banlist_info.ban_tcg === 'Limited' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          TCG: {selectedCardDetail.card.banlist_info.ban_tcg}
                        </span>
                      )}
                      {selectedCardDetail.card.banlist_info.ban_ocg && (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          selectedCardDetail.card.banlist_info.ban_ocg === 'Banned' ? 'bg-red-100 text-red-800' :
                          selectedCardDetail.card.banlist_info.ban_ocg === 'Limited' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          OCG: {selectedCardDetail.card.banlist_info.ban_ocg}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Collection Info Section */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-semibold text-gray-800 mb-4">Infos de votre collection</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 uppercase">Code Set</p>
                    <p className="font-semibold text-blue-700">{selectedCardDetail.set_code}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 uppercase">Rareté</p>
                    <p className="font-semibold text-purple-700">{selectedCardDetail.rarity}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 uppercase">Langue</p>
                    <p className="font-semibold text-green-700">
                      {LANGUAGE_LABELS[selectedCardDetail.language] || selectedCardDetail.language}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 uppercase">Quantité</p>
                    <p className="font-semibold text-orange-700">{selectedCardDetail.quantity}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedCardDetail(null)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeckEditor;
