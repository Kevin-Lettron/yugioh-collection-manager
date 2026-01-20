import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { UserCard, CollectionFilters } from '../../../shared/types';
import api from '../services/api';
import toast from 'react-hot-toast';

const Collection = () => {
  const { user, logout } = useAuth();
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
  const [cardCode, setCardCode] = useState('');
  const [selectedSet, setSelectedSet] = useState('');
  const [selectedRarity, setSelectedRarity] = useState('');
  const [quantity, setQuantity] = useState(1);

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

  const handleAddCard = async (e: FormEvent) => {
    e.preventDefault();

    if (!cardCode || !selectedSet || !selectedRarity) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await api.post('/collection/cards/add', {
        card_code: cardCode,
        set_code: selectedSet,
        rarity: selectedRarity,
        quantity,
      });

      toast.success('Card added to collection!');
      setShowAddModal(false);
      setCardCode('');
      setSelectedSet('');
      setSelectedRarity('');
      setQuantity(1);

      // Refresh collection
      setPage(1);
      fetchCards(1);
    } catch (error) {
      console.error('Failed to add card:', error);
    }
  };

  const handleRemoveCard = async (cardId: number) => {
    if (!confirm('Are you sure you want to remove this card from your collection?')) {
      return;
    }

    try {
      await api.delete(`/collection/cards/${cardId}`);
      toast.success('Card removed from collection');
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
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-blue-600">YuGiOh Manager</h1>
              <div className="hidden md:flex space-x-4">
                <Link to="/collection" className="text-blue-600 font-semibold px-3 py-2 rounded-md">
                  Collection
                </Link>
                <Link to="/decks" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md">
                  Decks
                </Link>
                <Link to="/social" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md">
                  Social
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/profile"
                className="text-gray-700 hover:text-blue-600 font-medium"
              >
                {user?.username}
              </Link>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">My Collection</h2>
            <p className="text-gray-600 mt-1">Total: {totalCards} cards</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            + Add Card
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  handleFilterChange();
                }}
                placeholder="Card name..."
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
                <option value="">All Types</option>
                <option value="Effect Monster">Effect Monster</option>
                <option value="Normal Monster">Normal Monster</option>
                <option value="Spell Card">Spell Card</option>
                <option value="Trap Card">Trap Card</option>
                <option value="Fusion Monster">Fusion Monster</option>
                <option value="Synchro Monster">Synchro Monster</option>
                <option value="XYZ Monster">XYZ Monster</option>
                <option value="Link Monster">Link Monster</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Attribute</label>
              <select
                value={attribute}
                onChange={(e) => {
                  setAttribute(e.target.value);
                  handleFilterChange();
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">All Attributes</option>
                <option value="DARK">DARK</option>
                <option value="LIGHT">LIGHT</option>
                <option value="EARTH">EARTH</option>
                <option value="WATER">WATER</option>
                <option value="FIRE">FIRE</option>
                <option value="WIND">WIND</option>
                <option value="DIVINE">DIVINE</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rarity</label>
              <select
                value={rarity}
                onChange={(e) => {
                  setRarity(e.target.value);
                  handleFilterChange();
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">All Rarities</option>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {cards.map((userCard) => (
            <div
              key={userCard.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden"
            >
              <img
                src={userCard.card?.card_images?.[0]?.image_url_small || '/placeholder-card.png'}
                alt={userCard.card?.name}
                className="w-full h-auto"
              />
              <div className="p-3">
                <h3 className="font-semibold text-sm text-gray-800 truncate">
                  {userCard.card?.name}
                </h3>
                <p className="text-xs text-gray-600 mb-2">{userCard.rarity}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleUpdateQuantity(userCard.id, userCard.quantity - 1)}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 w-6 h-6 rounded flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="font-semibold">{userCard.quantity}</span>
                    <button
                      onClick={() => handleUpdateQuantity(userCard.id, userCard.quantity + 1)}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 w-6 h-6 rounded flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => handleRemoveCard(userCard.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Remove
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
            <p className="text-gray-600 text-lg">No cards in your collection yet.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-semibold"
            >
              Add your first card
            </button>
          </div>
        )}
      </div>

      {/* Add Card Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Add Card</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddCard} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Card Code/ID
                </label>
                <input
                  type="text"
                  value={cardCode}
                  onChange={(e) => setCardCode(e.target.value)}
                  placeholder="e.g., 46986414"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Set Code</label>
                <input
                  type="text"
                  value={selectedSet}
                  onChange={(e) => setSelectedSet(e.target.value)}
                  placeholder="e.g., LOB-001"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rarity</label>
                <select
                  value={selectedRarity}
                  onChange={(e) => setSelectedRarity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Select rarity</option>
                  <option value="Common">Common</option>
                  <option value="Rare">Rare</option>
                  <option value="Super Rare">Super Rare</option>
                  <option value="Ultra Rare">Ultra Rare</option>
                  <option value="Secret Rare">Secret Rare</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
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
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                  Add Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Collection;
