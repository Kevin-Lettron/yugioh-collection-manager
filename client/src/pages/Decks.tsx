import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Deck, DeckFilters } from '../../../shared/types';
import api from '../services/api';
import toast from 'react-hot-toast';
import AppNavbar from '../components/AppNavbar';

interface WishlistItem {
  id: number;
  user_id: number;
  original_deck_id: number;
  created_at: string;
  deck: Deck;
}

const Decks = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'mydecks' | 'wishlist'>('mydecks');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [respectBanlist, setRespectBanlist] = useState<string>('');
  const [isPublic, setIsPublic] = useState<string>('');

  useEffect(() => {
    if (activeTab === 'mydecks') {
      fetchDecks();
    } else {
      fetchWishlist();
    }
  }, [activeTab, respectBanlist, isPublic]);

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

  const fetchWishlist = async () => {
    setLoading(true);
    try {
      const response = await api.get('/social/wishlist');
      setWishlist(response.data.wishlists || response.data || []);
    } catch (error) {
      console.error('Failed to fetch wishlist:', error);
      setWishlist([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDeck = async (deckId: number) => {
    if (!confirm('Etes-vous sur de vouloir supprimer ce deck ?')) {
      return;
    }

    try {
      await api.delete(`/decks/${deckId}`);
      toast.success('Deck supprime avec succes');
      setDecks((prev) => prev.filter((deck) => deck.id !== deckId));
    } catch (error) {
      console.error('Failed to delete deck:', error);
    }
  };

  const handleRemoveFromWishlist = async (deckId: number) => {
    try {
      await api.delete(`/social/wishlist/${deckId}`);
      toast.success('Deck retire de la wishlist');
      setWishlist((prev) => prev.filter((item) => item.original_deck_id !== deckId));
    } catch (error) {
      console.error('Failed to remove from wishlist:', error);
    }
  };

  const getDeckCardCount = (deck: Deck) => {
    const mainCount = deck.main_deck?.reduce((sum, card) => sum + card.quantity, 0) || 0;
    const extraCount = deck.extra_deck?.reduce((sum, card) => sum + card.quantity, 0) || 0;
    return { mainCount, extraCount };
  };

  const getWishlistDeckCardCount = (item: WishlistItem) => {
    // Use pre-computed counts if available, otherwise calculate from arrays
    const deck = item.deck;
    const mainCount = (deck as any).main_deck_count ?? deck.main_deck?.reduce((sum, card) => sum + card.quantity, 0) ?? 0;
    const extraCount = (deck as any).extra_deck_count ?? deck.extra_deck?.reduce((sum, card) => sum + card.quantity, 0) ?? 0;
    return { mainCount, extraCount };
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <AppNavbar />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-200 rounded-lg p-1 mb-6 max-w-md">
          <button
            onClick={() => setActiveTab('mydecks')}
            className={`flex-1 py-2 px-4 rounded-md font-semibold transition ${
              activeTab === 'mydecks'
                ? 'bg-white text-blue-600 shadow'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Mes Decks ({decks.length})
          </button>
          <button
            onClick={() => setActiveTab('wishlist')}
            className={`flex-1 py-2 px-4 rounded-md font-semibold transition ${
              activeTab === 'wishlist'
                ? 'bg-white text-purple-600 shadow'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Wishlist ({wishlist.length})
          </button>
        </div>

        {activeTab === 'mydecks' ? (
          <>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-800">Mes Decks</h2>
                <p className="text-gray-600 mt-1">{decks.length} deck(s)</p>
              </div>
              <Link
                to="/decks/new"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                + Creer un deck
              </Link>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Conformite Banlist
                  </label>
                  <select
                    value={respectBanlist}
                    onChange={(e) => setRespectBanlist(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Tous les decks</option>
                    <option value="true">Respecte la banlist</option>
                    <option value="false">Ignore la banlist</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Visibilite</label>
                  <select
                    value={isPublic}
                    onChange={(e) => setIsPublic(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Tous les decks</option>
                    <option value="true">Public</option>
                    <option value="false">Prive</option>
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
                              <span>Deck Principal :</span>
                              <span className={mainCount >= 40 && mainCount <= 60 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                                {mainCount} cartes
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Extra Deck :</span>
                              <span className={extraCount <= 15 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                                {extraCount} cartes
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Banlist :</span>
                              <span className={deck.respect_banlist ? 'text-green-600' : 'text-orange-600'}>
                                {deck.respect_banlist ? 'Conforme' : 'Ignoree'}
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
                              onClick={() => navigate(`/decks/${deck.id}/edit`)}
                              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
                            >
                              Voir / Editer
                            </button>
                            <button
                              onClick={() => handleDeleteDeck(deck.id)}
                              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-semibold text-sm"
                            >
                              Supprimer
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
                    <p className="text-gray-600 text-lg mb-4">Vous n'avez pas encore de deck.</p>
                    <Link
                      to="/decks/new"
                      className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
                    >
                      Creer votre premier deck
                    </Link>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* Wishlist Header */}
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-800">Ma Wishlist</h2>
              <p className="text-gray-600 mt-1">
                {wishlist.length} deck(s) sauvegardes d'autres joueurs
              </p>
            </div>

            {/* Loading */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
              </div>
            ) : (
              <>
                {/* Wishlist Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {wishlist.map((item) => {
                    const deck = item.deck;
                    const { mainCount, extraCount } = getWishlistDeckCardCount(item);
                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-lg shadow hover:shadow-xl transition overflow-hidden border-2 border-purple-200"
                      >
                        {/* Deck Cover */}
                        <div className="h-48 bg-gradient-to-br from-purple-600 to-pink-500 relative">
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
                          <span className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded flex items-center">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                            </svg>
                            Wishlist
                          </span>
                        </div>

                        {/* Deck Info */}
                        <div className="p-4">
                          <h3 className="font-bold text-xl text-gray-800 mb-1">{deck.name}</h3>
                          <p className="text-sm text-gray-500 mb-3">
                            par <span className="text-purple-600 font-medium">{deck.user?.username || 'Inconnu'}</span>
                          </p>

                          <div className="space-y-2 text-sm text-gray-600 mb-4">
                            <div className="flex justify-between">
                              <span>Deck Principal :</span>
                              <span className="font-semibold">{mainCount} cartes</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Extra Deck :</span>
                              <span className="font-semibold">{extraCount} cartes</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Banlist :</span>
                              <span className={deck.respect_banlist ? 'text-green-600' : 'text-orange-600'}>
                                {deck.respect_banlist ? 'Conforme' : 'Ignoree'}
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
                            <span className="text-xs text-gray-400">
                              Ajoute le {new Date(item.created_at).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex space-x-2">
                            <button
                              onClick={() => navigate(`/decks/${deck.id}`)}
                              className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition font-semibold text-sm"
                            >
                              Voir le deck
                            </button>
                            <button
                              onClick={() => handleRemoveFromWishlist(deck.id)}
                              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition font-semibold text-sm"
                              title="Retirer de la wishlist"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Empty state */}
                {wishlist.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-lg shadow">
                    <svg
                      className="mx-auto h-16 w-16 text-purple-300 mb-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Votre wishlist est vide</h3>
                    <p className="text-gray-600 mb-4">
                      Parcourez les decks publics et ajoutez ceux qui vous interessent a votre wishlist !
                    </p>
                    <Link
                      to="/social"
                      className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition font-semibold"
                    >
                      Decouvrir des decks
                    </Link>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Decks;
