import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Follow } from '../../../shared/types';
import api, { getImageUrl } from '../services/api';
import toast from 'react-hot-toast';
import AppNavbar from '../components/AppNavbar';

const Followers = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>('followers');
  const [followers, setFollowers] = useState<Follow[]>([]);
  const [following, setFollowing] = useState<Follow[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [followersRes, followingRes] = await Promise.all([
        api.get('/social/followers'),
        api.get('/social/following'),
      ]);

      // Extract arrays from response (API returns { followers: [...], total: ... })
      const followersData = followersRes.data.followers || followersRes.data || [];
      const followingData = followingRes.data.following || followingRes.data || [];

      setFollowers(followersData);
      setFollowing(followingData);

      // Create set of user IDs we're following
      const followingUserIds = new Set<number>(
        followingData.map((f: Follow) => f.following_id || f.following?.id || f.id)
      );
      setFollowingIds(followingUserIds);
    } catch (error) {
      console.error('Failed to fetch followers/following:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: number) => {
    try {
      await api.post(`/social/follow/${userId}`);
      setFollowingIds((prev) => new Set([...prev, userId]));
      toast.success('Utilisateur suivi !');
      // Refresh data to get updated lists
      fetchData();
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
      // Refresh data to get updated lists
      fetchData();
    } catch (error) {
      console.error('Failed to unfollow user:', error);
    }
  };

  const renderUserCard = (followRecord: any, isFollowerTab: boolean) => {
    // The API returns user data directly (not nested in follower/following objects)
    // So followRecord IS the user, or it has follower/following nested
    const displayUser = followRecord.follower || followRecord.following || followRecord;

    if (!displayUser || !displayUser.id) return null;

    const isFollowing = followingIds.has(displayUser.id);
    const isSelf = displayUser.id === user?.id;

    return (
      <div
        key={displayUser.id}
        className="bg-white rounded-lg shadow p-4 flex items-center space-x-4 hover:shadow-md transition"
      >
        {/* Avatar */}
        {displayUser.profile_picture ? (
          <img
            src={getImageUrl(displayUser.profile_picture)}
            alt={displayUser.username}
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">
              {displayUser.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* User Info */}
        <div className="flex-1">
          <h3 className="font-bold text-gray-800 text-lg">{displayUser.username}</h3>
          <p className="text-sm text-gray-600">{displayUser.email}</p>
          <p className="text-xs text-gray-500 mt-1">
            Inscrit le {new Date(displayUser.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col space-y-2">
          {!isSelf && (
            <>
              {isFollowing ? (
                <button
                  onClick={() => handleUnfollow(displayUser.id)}
                  className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition text-sm font-semibold"
                >
                  Ne plus suivre
                </button>
              ) : (
                <button
                  onClick={() => handleFollow(displayUser.id)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
                >
                  Suivre en retour
                </button>
              )}
            </>
          )}
          <button
            onClick={() => navigate(`/profile/${displayUser.id}`)}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition text-sm font-semibold"
          >
            Voir le profil
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <AppNavbar />

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Connexions sociales</h2>

          {/* Tabs */}
          <div className="flex space-x-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('followers')}
              className={`pb-3 px-6 font-semibold transition ${
                activeTab === 'followers'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              Abonnés ({followers.length})
            </button>
            <button
              onClick={() => setActiveTab('following')}
              className={`pb-3 px-6 font-semibold transition ${
                activeTab === 'following'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              Abonnements ({following.length})
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : (
          <>
            {/* Followers Tab */}
            {activeTab === 'followers' && (
              <div className="space-y-4">
                {followers.length > 0 ? (
                  followers.map((follower) => renderUserCard(follower, true))
                ) : (
                  <div className="text-center py-12 bg-white rounded-lg shadow">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-gray-900">Aucun abonné pour le moment</h3>
                    <p className="mt-2 text-sm text-gray-500">
                      Partagez vos decks publics pour gagner des abonnés !
                    </p>
                    <div className="mt-6">
                      <Link
                        to="/social"
                        className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
                      >
                        Explorer le fil d'actualités
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Following Tab */}
            {activeTab === 'following' && (
              <div className="space-y-4">
                {following.length > 0 ? (
                  following.map((follow) => renderUserCard(follow, false))
                ) : (
                  <div className="text-center py-12 bg-white rounded-lg shadow">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-gray-900">Vous ne suivez personne pour le moment</h3>
                    <p className="mt-2 text-sm text-gray-500">
                      Découvrez des utilisateurs et suivez-les pour voir leurs decks dans votre fil
                    </p>
                    <div className="mt-6">
                      <Link
                        to="/social"
                        className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
                      >
                        Trouver des utilisateurs à suivre
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Followers;
