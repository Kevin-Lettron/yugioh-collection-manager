import { useState, useEffect, FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { Deck, Card, DeckCard, UserCard } from '../../../shared/types';
import api from '../services/api';
import toast from 'react-hot-toast';

const DeckEditor = () => {
  const { deckId } = useParams<{ deckId?: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isEditing = !!deckId;

  // Deck info
  const [deckName, setDeckName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [respectBanlist, setRespectBanlist] = useState(true);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  // Deck cards
  const [mainDeck, setMainDeck] = useState<DeckCard[]>([]);
  const [extraDeck, setExtraDeck] = useState<DeckCard[]>([]);

  // Card search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [searching, setSearching] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 500);

  // Validation
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

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

  const fetchDeck = async () => {
    try {
      const response = await api.get(`/decks/${deckId}`);
      const deck: Deck = response.data;

      setDeckName(deck.name);
      setIsPublic(deck.is_public);
      setRespectBanlist(deck.respect_banlist);
      setMainDeck(deck.main_deck || []);
      setExtraDeck(deck.extra_deck || []);
    } catch (error) {
      console.error('Failed to fetch deck:', error);
      toast.error('Failed to load deck');
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

  const validateDeck = async () => {
    const errors: string[] = [];
    const mainCount = mainDeck.reduce((sum, card) => sum + card.quantity, 0);
    const extraCount = extraDeck.reduce((sum, card) => sum + card.quantity, 0);

    // Main deck validation
    if (mainCount < 40) {
      errors.push(`Main deck must have at least 40 cards (currently ${mainCount})`);
    }
    if (mainCount > 60) {
      errors.push(`Main deck cannot exceed 60 cards (currently ${mainCount})`);
    }

    // Extra deck validation
    if (extraCount > 15) {
      errors.push(`Extra deck cannot exceed 15 cards (currently ${extraCount})`);
    }

    // Check for duplicate violations (max 3 of same card)
    const allCards = [...mainDeck, ...extraDeck];
    const cardCounts = new Map<number, number>();
    allCards.forEach((deckCard) => {
      const current = cardCounts.get(deckCard.card_id) || 0;
      cardCounts.set(deckCard.card_id, current + deckCard.quantity);
    });

    cardCounts.forEach((count, cardId) => {
      if (count > 3) {
        const card = [...mainDeck, ...extraDeck].find((dc) => dc.card_id === cardId)?.card;
        errors.push(`Cannot have more than 3 copies of ${card?.name || 'a card'} (currently ${count})`);
      }
    });

    // Banlist validation (if enabled)
    if (respectBanlist && isEditing && deckId) {
      try {
        const response = await api.get(`/decks/${deckId}/validate`);
        if (response.data.violations && response.data.violations.length > 0) {
          response.data.violations.forEach((violation: any) => {
            errors.push(`Banlist violation: ${violation.card_name} (${violation.status})`);
          });
        }
      } catch (error) {
        // Validation endpoint might not be available yet
      }
    }

    setValidationErrors(errors);
  };

  const addCardToDeck = (card: Card, isExtra: boolean) => {
    const targetDeck = isExtra ? extraDeck : mainDeck;
    const setTargetDeck = isExtra ? setExtraDeck : setMainDeck;

    // Check if card already exists in deck
    const existingCard = targetDeck.find((dc) => dc.card_id === card.id);

    if (existingCard) {
      // Increment quantity
      setTargetDeck(
        targetDeck.map((dc) =>
          dc.card_id === card.id ? { ...dc, quantity: dc.quantity + 1 } : dc
        )
      );
    } else {
      // Add new card
      const newDeckCard: DeckCard = {
        id: Date.now(), // Temporary ID
        deck_id: parseInt(deckId || '0'),
        card_id: card.id,
        quantity: 1,
        is_extra_deck: isExtra,
        created_at: new Date(),
        card,
      };
      setTargetDeck([...targetDeck, newDeckCard]);
    }

    toast.success(`Added ${card.name} to ${isExtra ? 'Extra' : 'Main'} Deck`);
  };

  const removeCardFromDeck = (cardId: number, isExtra: boolean) => {
    const targetDeck = isExtra ? extraDeck : mainDeck;
    const setTargetDeck = isExtra ? setExtraDeck : setMainDeck;

    setTargetDeck(targetDeck.filter((dc) => dc.card_id !== cardId));
  };

  const updateCardQuantity = (cardId: number, isExtra: boolean, delta: number) => {
    const targetDeck = isExtra ? extraDeck : mainDeck;
    const setTargetDeck = isExtra ? setExtraDeck : setMainDeck;

    setTargetDeck(
      targetDeck
        .map((dc) => {
          if (dc.card_id === cardId) {
            const newQuantity = dc.quantity + delta;
            return newQuantity > 0 ? { ...dc, quantity: newQuantity } : null;
          }
          return dc;
        })
        .filter((dc): dc is DeckCard => dc !== null)
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!deckName.trim()) {
      toast.error('Please enter a deck name');
      return;
    }

    if (validationErrors.length > 0) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    setSaving(true);
    try {
      let savedDeckId = deckId;

      if (isEditing) {
        // Update existing deck
        await api.put(`/decks/${deckId}`, {
          name: deckName,
          is_public: isPublic,
          respect_banlist: respectBanlist,
        });
      } else {
        // Create new deck
        const response = await api.post('/decks', {
          name: deckName,
          is_public: isPublic,
          respect_banlist: respectBanlist,
        });
        savedDeckId = response.data.id.toString();
      }

      // Update deck cards
      if (savedDeckId) {
        // Clear existing cards and add new ones
        const allCards = [
          ...mainDeck.map((dc) => ({ ...dc, is_extra_deck: false })),
          ...extraDeck.map((dc) => ({ ...dc, is_extra_deck: true })),
        ];

        for (const deckCard of allCards) {
          await api.post(`/decks/${savedDeckId}/cards`, {
            card_id: deckCard.card_id,
            quantity: deckCard.quantity,
            is_extra_deck: deckCard.is_extra_deck,
          });
        }
      }

      toast.success(isEditing ? 'Deck updated successfully!' : 'Deck created successfully!');
      navigate('/decks');
    } catch (error) {
      console.error('Failed to save deck:', error);
    } finally {
      setSaving(false);
    }
  };

  const isExtraCard = (card: Card): boolean => {
    const extraTypes = ['Fusion Monster', 'Synchro Monster', 'XYZ Monster', 'Link Monster'];
    return extraTypes.includes(card.type);
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-blue-600">YuGiOh Manager</h1>
              <div className="hidden md:flex space-x-4">
                <Link to="/collection" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md">
                  Collection
                </Link>
                <Link to="/decks" className="text-blue-600 font-semibold px-3 py-2 rounded-md">
                  Decks
                </Link>
                <Link to="/social" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md">
                  Social
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/profile" className="text-gray-700 hover:text-blue-600 font-medium">
                {user?.username}
              </Link>
              <button onClick={logout} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800">
            {isEditing ? 'Edit Deck' : 'Create New Deck'}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Deck Settings & Search */}
          <div className="lg:col-span-1 space-y-6">
            {/* Deck Settings */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Deck Settings</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Deck Name</label>
                  <input
                    type="text"
                    value={deckName}
                    onChange={(e) => setDeckName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Enter deck name"
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
                    Make deck public
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
                    Respect banlist
                  </label>
                </div>

                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-red-800 mb-2">Validation Errors:</h4>
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
                      <span>Main Deck:</span>
                      <span className={mainDeckCount >= 40 && mainDeckCount <= 60 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {mainDeckCount} / 60
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Extra Deck:</span>
                      <span className={extraDeckCount <= 15 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {extraDeckCount} / 15
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
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || validationErrors.length > 0}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-blue-400 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Deck'}
                  </button>
                </div>
              </form>
            </div>

            {/* Card Search */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Add Cards</h3>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-4"
                placeholder="Search cards in collection..."
              />

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searching && (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                  </div>
                )}

                {searchResults.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                    onClick={() => addCardToDeck(card, isExtraCard(card))}
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
                  </div>
                ))}

                {!searching && searchQuery && searchResults.length === 0 && (
                  <p className="text-center text-gray-600 py-4">No cards found</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Deck Lists */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Deck */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Main Deck ({mainDeckCount} cards)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {mainDeck.map((deckCard) => (
                  <div key={deckCard.card_id} className="relative group">
                    <img
                      src={deckCard.card?.card_images?.[0]?.image_url_small || '/placeholder-card.png'}
                      alt={deckCard.card?.name}
                      className="w-full h-auto rounded shadow"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-2">
                      <p className="text-xs font-semibold truncate">{deckCard.card?.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => updateCardQuantity(deckCard.card_id, false, -1)}
                            className="bg-red-600 hover:bg-red-700 w-5 h-5 rounded flex items-center justify-center text-xs"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold">{deckCard.quantity}</span>
                          <button
                            onClick={() => updateCardQuantity(deckCard.card_id, false, 1)}
                            className="bg-green-600 hover:bg-green-700 w-5 h-5 rounded flex items-center justify-center text-xs"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeCardFromDeck(deckCard.card_id, false)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {mainDeck.length === 0 && (
                <p className="text-center text-gray-600 py-8">
                  No cards in Main Deck. Search and add cards from your collection.
                </p>
              )}
            </div>

            {/* Extra Deck */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Extra Deck ({extraDeckCount} cards)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {extraDeck.map((deckCard) => (
                  <div key={deckCard.card_id} className="relative group">
                    <img
                      src={deckCard.card?.card_images?.[0]?.image_url_small || '/placeholder-card.png'}
                      alt={deckCard.card?.name}
                      className="w-full h-auto rounded shadow"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-2">
                      <p className="text-xs font-semibold truncate">{deckCard.card?.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => updateCardQuantity(deckCard.card_id, true, -1)}
                            className="bg-red-600 hover:bg-red-700 w-5 h-5 rounded flex items-center justify-center text-xs"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold">{deckCard.quantity}</span>
                          <button
                            onClick={() => updateCardQuantity(deckCard.card_id, true, 1)}
                            className="bg-green-600 hover:bg-green-700 w-5 h-5 rounded flex items-center justify-center text-xs"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeCardFromDeck(deckCard.card_id, true)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {extraDeck.length === 0 && (
                <p className="text-center text-gray-600 py-8">
                  No cards in Extra Deck. Fusion, Synchro, XYZ, and Link monsters go here.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeckEditor;
