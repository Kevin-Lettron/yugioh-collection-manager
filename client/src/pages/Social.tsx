import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { Deck, User } from '../../../shared/types';
import api from '../services/api';
import toast from 'react-hot-toast';
import AppNavbar from '../components/AppNavbar';

const Social = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState<'decks' | 'users'>('decks');

  // Decks feed
  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [decksPage, setDecksPage] = useState(1);
  const [hasMoreDecks, setHasMoreDecks] = useState(true);

  // Users search
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const debouncedUserSearch = useDebounce(userSearch, 500);

  // Following state
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());

  const decksLoadMoreRef = useInfiniteScroll({
    loading: decksLoading,
    hasMore: hasMoreDecks,
    onLoadMore: () => setDecksPage((prev) => prev + 1),
  });

  useEffect(() => {
    fetchFollowing();
  }, []);

  useEffect(() => {
    if (activeTab === 'decks') {
      fetchDecks(decksPage);
    }
  }, [decksPage, activeTab]);

  useEffect(() => {
    if (activeTab === 'users') {
      searchUsers();
    }
  }, [debouncedUserSearch, activeTab]);

  const fetchFollowing = async () => {
    try {
      const response = await api.get('/social/following');
      const following = response.data.following || response.data || [];
      setFollowingIds(new Set(following.map((f: any) => f.following_id || f.id)));
    } catch (error) {
      console.error('Failed to fetch following:', error);
    }
  };

  const fetchDecks = async (page: number) => {
    setDecksLoading(true);
    try {
      const response = await api.get('/decks/public', {
        params: { page, limit: 12 },
      });

      const { data, total_pages } = response.data;

      // Filter out current user's decks - only show other users' decks in the feed
      const filteredData = data.filter((deck: Deck) => deck.user_id !== user?.id);

      if (page === 1) {
        setDecks(filteredData);
      } else {
        setDecks((prev) => [...prev, ...filteredData]);
      }

      setHasMoreDecks(page < total_pages);
    } catch (error) {
      console.error('Failed to fetch public decks:', error);
    } finally {
      setDecksLoading(false);
    }
  };

  const searchUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await api.get('/auth/users/search', {
        params: { q: debouncedUserSearch || undefined },
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleFollow = async (userId: number) => {
    try {
      await api.post(`/social/follow/${userId}`);
      setFollowingIds((prev) => new Set([...prev, userId]));
      toast.success('Utilisateur suivi !');
    } catch (error) {
      console.error('Failed to follow user:', error);
    }
  };

  const handleUnfollow = async (userId: number) => {
    try {
      await api.delete(`/social/follow/${userId}`);
      setFollowingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      toast.success('Utilisateur ne plus suivi');
    } catch (error) {
      console.error('Failed to unfollow user:', error);
    }
  };

  const getDeckCardCount = (deck: any) => {
    // Use pre-computed counts from API if available, otherwise calculate from arrays
    const mainCount = deck.main_deck_count ?? deck.main_deck?.reduce((sum: number, card: any) => sum + card.quantity, 0) ?? 0;
    const extraCount = deck.extra_deck_count ?? deck.extra_deck?.reduce((sum: number, card: any) => sum + card.quantity, 0) ?? 0;
    return { mainCount, extraCount };
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <AppNavbar />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Fil d'actualités</h2>

          {/* Tabs */}
          <div className="flex space-x-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('decks')}
              className={`pb-3 px-4 font-semibold transition ${
                activeTab === 'decks'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              Decks publics
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`pb-3 px-4 font-semibold transition ${
                activeTab === 'users'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              Trouver des utilisateurs
            </button>
          </div>
        </div>

        {/* Decks Tab */}
        {activeTab === 'decks' && (
          <div>
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
                    </div>

                    {/* Deck Info */}
                    <div className="p-4">
                      <h3 className="font-bold text-xl text-gray-800 mb-1">{deck.name}</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        par{' '}
                        <span className="text-blue-600 hover:text-blue-700 cursor-pointer">
                          {deck.user?.username}
                        </span>
                      </p>

                      <div className="space-y-1 text-sm text-gray-600 mb-4">
                        <div className="flex justify-between">
                          <span>Principal :</span>
                          <span className="font-semibold">{mainCount} cartes</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Extra :</span>
                          <span className="font-semibold">{extraCount} cartes</span>
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
                      <button
                        onClick={() => navigate(`/decks/${deck.id}`)}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
                      >
                        Voir le deck
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Loading */}
            {decksLoading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
              </div>
            )}

            {/* Load more trigger */}
            <div ref={decksLoadMoreRef} className="h-10" />

            {/* Empty state */}
            {!decksLoading && decks.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">Aucun deck public disponible pour le moment.</p>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            {/* Search Bar */}
            <div className="mb-6">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Rechercher des utilisateurs..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Users List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map((searchUser) => (
                <div
                  key={searchUser.id}
                  className="bg-white rounded-lg shadow p-4 flex items-center space-x-4"
                >
                  {/* Avatar */}
                  {searchUser.profile_picture ? (
                    <img
                      src={searchUser.profile_picture}
                      alt={searchUser.username}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">
                        {searchUser.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* User Info */}
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{searchUser.username}</h3>
                    <p className="text-sm text-gray-600">{searchUser.email}</p>
                  </div>

                  {/* Follow Button */}
                  {searchUser.id !== user?.id && (
                    <div>
                      {followingIds.has(searchUser.id) ? (
                        <button
                          onClick={() => handleUnfollow(searchUser.id)}
                          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition text-sm font-semibold"
                        >
                          Ne plus suivre
                        </button>
                      ) : (
                        <button
                          onClick={() => handleFollow(searchUser.id)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
                        >
                          Suivre
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Loading */}
            {usersLoading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
              </div>
            )}

            {/* Empty state */}
            {!usersLoading && users.length === 0 && userSearch && (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">Aucun utilisateur trouvé pour "{userSearch}"</p>
              </div>
            )}

            {!usersLoading && users.length === 0 && !userSearch && (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">Recherchez des utilisateurs pour vous connecter</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Social;
