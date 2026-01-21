import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Deck } from '../../../shared/types';
import api, { getImageUrl } from '../services/api';
import toast from 'react-hot-toast';
import AppNavbar from '../components/AppNavbar';

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [decksLoading, setDecksLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [stats, setStats] = useState({
    followersCount: 0,
    followingCount: 0,
  });

  const isOwnProfile = currentUser && parseInt(userId || '0') === currentUser.id;

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
      fetchUserDecks();
      if (!isOwnProfile) {
        checkIfFollowing();
      }
    }
  }, [userId, currentUser]);

  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/auth/users/${userId}`);
      setProfileUser(response.data.user);
      setStats({
        followersCount: response.data.followerCount || 0,
        followingCount: response.data.followingCount || 0,
      });
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      toast.error('Utilisateur non trouvé');
      navigate('/social');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDecks = async () => {
    setDecksLoading(true);
    try {
      const response = await api.get('/decks/public', {
        params: { user_id: userId, limit: 50 },
      });
      setDecks(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to fetch user decks:', error);
      setDecks([]);
    } finally {
      setDecksLoading(false);
    }
  };

  const checkIfFollowing = async () => {
    try {
      const response = await api.get('/social/following');
      const following = response.data.following || response.data || [];
      const isFollowingUser = following.some(
        (f: any) => (f.following_id || f.id) === parseInt(userId!)
      );
      setIsFollowing(isFollowingUser);
    } catch (error) {
      console.error('Failed to check following status:', error);
    }
  };

  const handleFollow = async () => {
    setFollowLoading(true);
    try {
      await api.post(`/social/follow/${userId}`);
      setIsFollowing(true);
      setStats((prev) => ({
        ...prev,
        followersCount: prev.followersCount + 1,
      }));
      toast.success('Utilisateur suivi !');
    } catch (error) {
      console.error('Failed to follow user:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleUnfollow = async () => {
    setFollowLoading(true);
    try {
      await api.delete(`/social/follow/${userId}`);
      setIsFollowing(false);
      setStats((prev) => ({
        ...prev,
        followersCount: Math.max(0, prev.followersCount - 1),
      }));
      toast.success('Vous ne suivez plus cet utilisateur');
    } catch (error) {
      console.error('Failed to unfollow user:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const getDeckCardCount = (deck: any) => {
    // Use pre-computed counts from API if available, otherwise calculate from arrays
    const mainCount = deck.main_deck_count ?? deck.main_deck?.reduce((sum: number, card: any) => sum + card.quantity, 0) ?? 0;
    const extraCount = deck.extra_deck_count ?? deck.extra_deck?.reduce((sum: number, card: any) => sum + card.quantity, 0) ?? 0;
    return { mainCount, extraCount };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Utilisateur non trouve</h2>
          <Link to="/social" className="text-blue-600 hover:text-blue-700">
            Retour au fil d'actualites
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <AppNavbar />

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
            {/* Avatar */}
            {profileUser.profile_picture ? (
              <img
                src={getImageUrl(profileUser.profile_picture)}
                alt={profileUser.username}
                className="w-32 h-32 rounded-full object-cover border-4 border-blue-500"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-blue-500 flex items-center justify-center border-4 border-blue-600">
                <span className="text-white text-4xl font-bold">
                  {profileUser.username.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">{profileUser.username}</h2>
              <p className="text-gray-600 mb-4">
                Membre depuis {new Date(profileUser.created_at).toLocaleDateString()}
              </p>

              {/* Stats */}
              <div className="flex justify-center md:justify-start space-x-6 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{stats.followersCount}</p>
                  <p className="text-sm text-gray-600">Abonnes</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{stats.followingCount}</p>
                  <p className="text-sm text-gray-600">Abonnements</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{decks.length}</p>
                  <p className="text-sm text-gray-600">Decks publics</p>
                </div>
              </div>

              {/* Follow Button or Edit Profile Button */}
              {isOwnProfile ? (
                <button
                  onClick={() => navigate('/profile')}
                  className="px-6 py-2 rounded-lg font-semibold transition bg-blue-600 text-white hover:bg-blue-700"
                >
                  Modifier mon profil
                </button>
              ) : (
                <button
                  onClick={isFollowing ? handleUnfollow : handleFollow}
                  disabled={followLoading}
                  className={`px-6 py-2 rounded-lg font-semibold transition ${
                    isFollowing
                      ? 'bg-gray-600 text-white hover:bg-gray-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {followLoading ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Chargement...
                    </span>
                  ) : isFollowing ? (
                    'Ne plus suivre'
                  ) : (
                    'Suivre'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Public Decks Section */}
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Decks publics de {profileUser.username}</h3>
        </div>

        {decksLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : decks.length > 0 ? (
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
                    <h4 className="font-bold text-xl text-gray-800 mb-2">{deck.name}</h4>

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
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun deck public</h3>
            <p className="text-sm text-gray-500">
              {profileUser.username} n'a pas encore partage de decks publics.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
