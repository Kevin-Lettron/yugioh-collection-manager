import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Deck, DeckFilters } from '../../../shared/types';
import api from '../services/api';
import toast from 'react-hot-toast';

const Decks = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [respectBanlist, setRespectBanlist] = useState<string>('');
  const [isPublic, setIsPublic] = useState<string>('');

  useEffect(() => {
    fetchDecks();
  }, [respectBanlist, isPublic]);

  const fetchDecks = async () => {
    setLoading(true);
    try {
      const params: DeckFilters = {
        respect_banlist: respectBanlist === 'true' ? true : respectBanlist === 'false' ? false : undefined,
        is_public: isPublic === 'true' ? true : isPublic === 'false' ? false : undefined,
      };

      const response = await api.get('/decks', { params });
      setDecks(response.data.data || response.data);
    } catch (error) {
      console.error('Failed to fetch decks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDeck = async (deckId: number) => {
    if (!confirm('Are you sure you want to delete this deck?')) {
      return;
    }

    try {
      await api.delete(`/decks/${deckId}`);
      toast.success('Deck deleted successfully');
      setDecks((prev) => prev.filter((deck) => deck.id !== deckId));
    } catch (error) {
      console.error('Failed to delete deck:', error);
    }
  };

  const getDeckCardCount = (deck: Deck) => {
    const mainCount = deck.main_deck?.reduce((sum, card) => sum + card.quantity, 0) || 0;
    const extraCount = deck.extra_deck?.reduce((sum, card) => sum + card.quantity, 0) || 0;
    return { mainCount, extraCount };
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
            <h2 className="text-3xl font-bold text-gray-800">My Decks</h2>
            <p className="text-gray-600 mt-1">{decks.length} deck(s)</p>
          </div>
          <Link
            to="/decks/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            + Create Deck
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Banlist Compliance
              </label>
              <select
                value={respectBanlist}
                onChange={(e) => setRespectBanlist(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">All Decks</option>
                <option value="true">Respects Banlist</option>
                <option value="false">Ignores Banlist</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
              <select
                value={isPublic}
                onChange={(e) => setIsPublic(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">All Decks</option>
                <option value="true">Public</option>
                <option value="false">Private</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : (
          <>
            {/* Decks Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {decks.map((deck) => {
                const { mainCount, extraCount } = getDeckCardCount(deck);
                return (
                  <div
                    key={deck.id}
                    className="bg-white rounded-lg shadow hover:shadow-xl transition overflow-hidden"
                  >
                    {/* Deck Cover */}
                    <div className="h-48 bg-gradient-to-br from-purple-500 to-blue-500 relative">
                      {deck.cover_image ? (
                        <img
                          src={deck.cover_image}
                          alt={deck.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-white text-4xl font-bold opacity-50">
                            {deck.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {deck.is_public && (
                        <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                          Public
                        </span>
                      )}
                    </div>

                    {/* Deck Info */}
                    <div className="p-4">
                      <h3 className="font-bold text-xl text-gray-800 mb-2">{deck.name}</h3>

                      <div className="space-y-2 text-sm text-gray-600 mb-4">
                        <div className="flex justify-between">
                          <span>Main Deck:</span>
                          <span className={mainCount >= 40 && mainCount <= 60 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {mainCount} cards
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Extra Deck:</span>
                          <span className={extraCount <= 15 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {extraCount} cards
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Banlist:</span>
                          <span className={deck.respect_banlist ? 'text-green-600' : 'text-orange-600'}>
                            {deck.respect_banlist ? 'Compliant' : 'Ignored'}
                          </span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                          </svg>
                          {deck.likes_count || 0}
                        </span>
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                          </svg>
                          {deck.comments_count || 0}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex space-x-2">
                        <button
                          onClick={() => navigate(`/decks/${deck.id}`)}
                          className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
                        >
                          View
                        </button>
                        <button
                          onClick={() => navigate(`/decks/${deck.id}/edit`)}
                          className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition font-semibold text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteDeck(deck.id)}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-semibold text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty state */}
            {decks.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg mb-4">You don't have any decks yet.</p>
                <Link
                  to="/decks/new"
                  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                  Create Your First Deck
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Decks;
