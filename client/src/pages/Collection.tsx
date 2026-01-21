import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { UserCard, CollectionFilters, Card, CardLanguage } from '../../../shared/types';
import api from '../services/api';
import toast from 'react-hot-toast';
import AppNavbar from '../components/AppNavbar';

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

const Collection = () => {
  const { user } = useAuth();
  const [cards, setCards] = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCards, setTotalCards] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [attribute, setAttribute] = useState('');
  const [rarity, setRarity] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  // Add card modal
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

  // Card detail modal
  const [selectedCardDetail, setSelectedCardDetail] = useState<UserCard | null>(null);

  const loadMoreRef = useInfiniteScroll({
    loading,
    hasMore,
    onLoadMore: () => setPage((prev) => prev + 1),
  });

  useEffect(() => {
    fetchCards(page);
  }, [page, debouncedSearch, type, attribute, rarity]);

  const fetchCards = async (pageNum: number) => {
    setLoading(true);
    try {
      const params: CollectionFilters = {
        page: pageNum,
        limit: 20,
        search: debouncedSearch || undefined,
        type: type || undefined,
        attribute: attribute || undefined,
        rarity: rarity || undefined,
      };

      const response = await api.get('/collection/cards', { params });
      const { data, total, total_pages } = response.data;

      if (pageNum === 1) {
        setCards(data);
      } else {
        setCards((prev) => [...prev, ...data]);
      }

      setTotalCards(total);
      setHasMore(pageNum < total_pages);
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = () => {
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

      // Auto-select language from detected set code
      if (detectedLanguage) {
        setSelectedLanguage(detectedLanguage as CardLanguage);
      }

      // Auto-select set and rarity if found via set code
      if (originalSetCode && matchedSet) {
        // Use the ORIGINAL set code entered by user (e.g., LDK2-FRK40 for French)
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
      const message = error.response?.data?.message || 'Carte non trouvée';
      setSearchError(message);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSetChange = (setCode: string) => {
    setSelectedSet(setCode);
    // Auto-select rarity for this set
    const setInfo = availableSets.find((s) => s.set_code === setCode);
    if (setInfo) {
      setSelectedRarity(setInfo.set_rarity);
    }
  };

  const handleAddCard = async (e: FormEvent) => {
    e.preventDefault();

    if (!searchedCard || !selectedSet || !selectedRarity) {
      toast.error('Veuillez rechercher une carte et sélectionner le set/rareté');
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

      toast.success(`Carte ajoutée à la collection ! (${LANGUAGE_LABELS[selectedLanguage]})`);
      resetAddModal();

      // Refresh collection
      setPage(1);
      fetchCards(1);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Échec de l\'ajout de la carte';
      toast.error(message);
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
    if (!confirm('Êtes-vous sûr de vouloir retirer cette carte de votre collection ?')) {
      return;
    }

    try {
      await api.delete(`/collection/cards/${cardId}`);
      toast.success('Carte retirée de la collection');
      setCards((prev) => prev.filter((card) => card.id !== cardId));
      setTotalCards((prev) => prev - 1);
    } catch (error) {
      console.error('Failed to remove card:', error);
    }
  };

  const handleUpdateQuantity = async (cardId: number, newQuantity: number) => {
    if (newQuantity < 1) {
      handleRemoveCard(cardId);
      return;
    }

    try {
      await api.put(`/collection/cards/${cardId}/quantity`, { quantity: newQuantity });
      setCards((prev) =>
        prev.map((card) => (card.id === cardId ? { ...card, quantity: newQuantity } : card))
      );
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <AppNavbar />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Ma Collection</h2>
            <p className="text-gray-600 mt-1">Total : {totalCards} cartes</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            + Ajouter une carte
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-gray-700">Filtres</span>
            {(search || type || attribute || rarity) && (
              <button
                onClick={() => {
                  setSearch('');
                  setType('');
                  setAttribute('');
                  setRarity('');
                  handleFilterChange();
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher</label>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  handleFilterChange();
                }}
                placeholder="Nom de la carte..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  handleFilterChange();
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Attribut</label>
              <select
                value={attribute}
                onChange={(e) => {
                  setAttribute(e.target.value);
                  handleFilterChange();
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Rareté</label>
              <select
                value={rarity}
                onChange={(e) => {
                  setRarity(e.target.value);
                  handleFilterChange();
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Toutes les raretés</option>
                <option value="Common">Common</option>
                <option value="Short Print">Short Print</option>
                <option value="Rare">Rare</option>
                <option value="Super Rare">Super Rare</option>
                <option value="Ultra Rare">Ultra Rare</option>
                <option value="Secret Rare">Secret Rare</option>
                <option value="Ultimate Rare">Ultimate Rare</option>
                <option value="Ghost Rare">Ghost Rare</option>
                <option value="Starlight Rare">Starlight Rare</option>
                <option value="Collector's Rare">Collector's Rare</option>
                <option value="Prismatic Secret Rare">Prismatic Secret Rare</option>
                <option value="Platinum Secret Rare">Platinum Secret Rare</option>
                <option value="Quarter Century Secret Rare">Quarter Century Secret Rare</option>
                <option value="Gold Rare">Gold Rare</option>
                <option value="Gold Secret Rare">Gold Secret Rare</option>
                <option value="Premium Gold Rare">Premium Gold Rare</option>
                <option value="Starfoil Rare">Starfoil Rare</option>
                <option value="Mosaic Rare">Mosaic Rare</option>
                <option value="Shatterfoil Rare">Shatterfoil Rare</option>
                <option value="Duel Terminal Normal Parallel Rare">Duel Terminal Normal Parallel Rare</option>
                <option value="Duel Terminal Rare Parallel Rare">Duel Terminal Rare Parallel Rare</option>
                <option value="Duel Terminal Super Parallel Rare">Duel Terminal Super Parallel Rare</option>
                <option value="Duel Terminal Ultra Parallel Rare">Duel Terminal Ultra Parallel Rare</option>
                <option value="Parallel Rare">Parallel Rare</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {cards.map((userCard) => (
            <div
              key={userCard.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden"
            >
              <img
                src={userCard.card?.card_images?.[0]?.image_url_small || '/placeholder-card.png'}
                alt={userCard.card?.name}
                className="w-full h-auto cursor-pointer hover:opacity-90 transition"
                onClick={() => setSelectedCardDetail(userCard)}
              />
              <div className="p-3">
                <h3
                  className="font-semibold text-sm text-gray-800 truncate cursor-pointer hover:text-blue-600"
                  onClick={() => setSelectedCardDetail(userCard)}
                >
                  {userCard.card?.name}
                </h3>
                <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                  <span>{userCard.rarity}</span>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-medium">
                    {userCard.language || 'EN'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateQuantity(userCard.id, userCard.quantity - 1);
                      }}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 w-6 h-6 rounded flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="font-semibold">{userCard.quantity}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateQuantity(userCard.id, userCard.quantity + 1);
                      }}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 w-6 h-6 rounded flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveCard(userCard.id);
                    }}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Retirer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        )}

        {/* Load more trigger */}
        <div ref={loadMoreRef} className="h-10" />

        {/* Empty state */}
        {!loading && cards.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">Aucune carte dans votre collection.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-semibold"
            >
              Ajouter votre première carte
            </button>
          </div>
        )}
      </div>

      {/* Add Card Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Ajouter une carte</h3>
              <button
                onClick={resetAddModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>

            {/* Step 1: Search */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID de carte ou Code Set
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Entrez le Code Set (ex: LDK2-FRK40) situé sous l'illustration de la carte, ou l'ID de carte (ex: 46986414) en bas à gauche.
              </p>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchCard()}
                  placeholder="ex: LDK2-FRK40 ou 46986414"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={handleSearchCard}
                  disabled={searchLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-blue-300"
                >
                  {searchLoading ? 'Recherche...' : 'Rechercher'}
                </button>
              </div>
              {searchError && (
                <p className="text-red-500 text-sm mt-2">{searchError}</p>
              )}
            </div>

            {/* Step 2: Card Preview */}
            {searchedCard && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex space-x-4">
                  <img
                    src={searchedCard.card_images?.[0]?.image_url_small || '/placeholder-card.png'}
                    alt={searchedCard.name}
                    className="w-24 h-auto rounded"
                  />
                  <div className="flex-1">
                    <h4 className="font-bold text-lg text-gray-800">{searchedCard.name}</h4>
                    <p className="text-sm text-gray-600">{searchedCard.type}</p>
                    {searchedCard.attribute && (
                      <p className="text-sm text-gray-500">Attribut : {searchedCard.attribute}</p>
                    )}
                    {searchedCard.level && (
                      <p className="text-sm text-gray-500">Niveau : {searchedCard.level}</p>
                    )}
                    {(searchedCard.atk !== undefined || searchedCard.def !== undefined) && (
                      <p className="text-sm text-gray-500">
                        ATK : {searchedCard.atk ?? '?'} / DEF : {searchedCard.def ?? '?'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Select Set and Rarity */}
            {searchedCard && (
              <form onSubmit={handleAddCard} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code Set
                    {selectedSet && !availableSets.some(s => s.set_code === selectedSet) && (
                      <span className="ml-2 text-xs text-blue-600">
                        (Code de votre carte)
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={selectedSet}
                    onChange={(e) => setSelectedSet(e.target.value.toUpperCase())}
                    placeholder="ex: LDK2-FRK40"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  {availableSets.length > 0 && (
                    <div className="mt-2">
                      <label className="block text-xs text-gray-500 mb-1">
                        Ou choisir parmi {availableSets.length} sets disponibles :
                      </label>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleSetChange(e.target.value);
                          }
                        }}
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-gray-50"
                      >
                        <option value="">Sélectionner dans la liste...</option>
                        {availableSets.map((set) => (
                          <option key={set.set_code} value={set.set_code}>
                            {set.set_code} - {set.set_name} ({set.set_rarity})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rareté</label>
                  <select
                    value={selectedRarity}
                    onChange={(e) => setSelectedRarity(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Sélectionner la rareté</option>
                    <option value="Common">Common</option>
                    <option value="Short Print">Short Print</option>
                    <option value="Rare">Rare</option>
                    <option value="Super Rare">Super Rare</option>
                    <option value="Ultra Rare">Ultra Rare</option>
                    <option value="Secret Rare">Secret Rare</option>
                    <option value="Ultimate Rare">Ultimate Rare</option>
                    <option value="Ghost Rare">Ghost Rare</option>
                    <option value="Starlight Rare">Starlight Rare</option>
                    <option value="Collector's Rare">Collector's Rare</option>
                    <option value="Prismatic Secret Rare">Prismatic Secret Rare</option>
                    <option value="Platinum Secret Rare">Platinum Secret Rare</option>
                    <option value="Quarter Century Secret Rare">Quarter Century Secret Rare</option>
                    <option value="Gold Rare">Gold Rare</option>
                    <option value="Gold Secret Rare">Gold Secret Rare</option>
                    <option value="Premium Gold Rare">Premium Gold Rare</option>
                    <option value="Starfoil Rare">Starfoil Rare</option>
                    <option value="Mosaic Rare">Mosaic Rare</option>
                    <option value="Shatterfoil Rare">Shatterfoil Rare</option>
                    <option value="Duel Terminal Normal Parallel Rare">Duel Terminal Normal Parallel Rare</option>
                    <option value="Duel Terminal Rare Parallel Rare">Duel Terminal Rare Parallel Rare</option>
                    <option value="Duel Terminal Super Parallel Rare">Duel Terminal Super Parallel Rare</option>
                    <option value="Duel Terminal Ultra Parallel Rare">Duel Terminal Ultra Parallel Rare</option>
                    <option value="Parallel Rare">Parallel Rare</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Langue
                    {selectedLanguage !== 'EN' && (
                      <span className="ml-2 text-xs text-blue-600">
                        (Détecté automatiquement)
                      </span>
                    )}
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value as CardLanguage)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    {(Object.keys(LANGUAGE_LABELS) as CardLanguage[]).map((lang) => (
                      <option key={lang} value={lang}>
                        {LANGUAGE_LABELS[lang]} ({lang})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantité</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetAddModal}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedSet || !selectedRarity}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-blue-300"
                  >
                    Ajouter
                  </button>
                </div>
              </form>
            )}

            {/* Instructions when no card searched */}
            {!searchedCard && !searchLoading && (
              <div className="text-center py-8 text-gray-500">
                <p>Recherchez une carte par son Code Set ou ID de carte</p>
                <p className="text-sm mt-2">
                  Le Code Set se trouve sous l'illustration de la carte (ex: LDK2-FRK40)
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card Detail Modal */}
      {selectedCardDetail && selectedCardDetail.card && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
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
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    handleRemoveCard(selectedCardDetail.id);
                    setSelectedCardDetail(null);
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
                >
                  Retirer de la collection
                </button>
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

export default Collection;
