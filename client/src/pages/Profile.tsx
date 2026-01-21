import { useState, useEffect, FormEvent, ChangeEvent, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User } from '../../../shared/types';
import api, { getImageUrl } from '../services/api';
import toast from 'react-hot-toast';
import AppNavbar from '../components/AppNavbar';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Profile data
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profilePicture, setProfilePicture] = useState(user?.profile_picture || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Stats
  const [stats, setStats] = useState({
    totalCards: 0,
    totalDecks: 0,
    followersCount: 0,
    followingCount: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
      setProfilePicture(user.profile_picture || '');
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const [cardsRes, decksRes, followersRes, followingRes] = await Promise.all([
        api.get('/collection/cards', { params: { limit: 1 } }).catch(() => ({ data: { total: 0 } })),
        api.get('/decks', { params: { limit: 1 } }).catch(() => ({ data: { total: 0 } })),
        api.get('/social/followers').catch(() => ({ data: { followers: [], total: 0 } })),
        api.get('/social/following').catch(() => ({ data: { following: [], total: 0 } })),
      ]);

      // Handle different response structures
      const followersData = followersRes.data.followers || followersRes.data || [];
      const followingData = followingRes.data.following || followingRes.data || [];

      setStats({
        totalCards: cardsRes.data.total || 0,
        totalDecks: decksRes.data.total || decksRes.data.data?.length || decksRes.data.length || 0,
        followersCount: followersRes.data.total || followersData.length || 0,
        followingCount: followingRes.data.total || followingData.length || 0,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez télécharger un fichier image');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'image doit faire moins de 5 Mo');
      return;
    }

    const formData = new FormData();
    formData.append('profile_picture', file);

    setUploading(true);
    try {
      const response = await api.post('/auth/profile/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const updatedUser: User = response.data.user;
      setProfilePicture(updatedUser.profile_picture || '');
      updateUser(updatedUser);
      toast.success('Photo de profil mise à jour !');
    } catch (error) {
      console.error('Failed to upload avatar:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      toast.error('Le nom d\'utilisateur est requis');
      return;
    }

    if (username.length < 3) {
      toast.error('Le nom d\'utilisateur doit contenir au moins 3 caractères');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);
    try {
      const updateData: any = {
        username,
      };

      if (newPassword) {
        updateData.password = newPassword;
      }

      const response = await api.put('/auth/profile', updateData);
      const updatedUser: User = response.data;

      updateUser(updatedUser);
      toast.success('Profil mis à jour avec succès !');
      setEditing(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <AppNavbar />

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Mon Profil</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column - Profile Info */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              {/* Avatar with edit icon */}
              <div className="text-center mb-6">
                <div className="relative inline-block group">
                  {profilePicture ? (
                    <img
                      src={getImageUrl(profilePicture)}
                      alt={username}
                      className="w-32 h-32 rounded-full object-cover border-4 border-blue-500"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-blue-500 flex items-center justify-center border-4 border-blue-600">
                      <span className="text-white text-4xl font-bold">
                        {username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent"></div>
                    </div>
                  )}
                  {/* Edit icon button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Changer la photo"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-2xl font-bold text-gray-800 text-center">{stats.totalCards}</p>
                  <p className="text-sm text-gray-600 text-center">Cartes dans la collection</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-2xl font-bold text-gray-800 text-center">{stats.totalDecks}</p>
                  <p className="text-sm text-gray-600 text-center">Decks créés</p>
                </div>

                <Link to="/followers" className="block">
                  <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-lg font-bold text-gray-800">{stats.followersCount}</p>
                        <p className="text-xs text-gray-600">Abonnés</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-800">{stats.followingCount}</p>
                        <p className="text-xs text-gray-600">Abonnements</p>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column - Edit Form */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">Informations du compte</h3>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    data-edit-profile
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
                  >
                    Modifier le profil
                  </button>
                )}
              </div>

              {editing ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nom d'utilisateur</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="Nom d'utilisateur"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">L'email ne peut pas être modifié</p>
                  </div>

                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h4 className="font-semibold text-gray-800 mb-4">Changer le mot de passe (Optionnel)</h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nouveau mot de passe
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        placeholder="Laissez vide pour garder le mot de passe actuel"
                      />
                    </div>

                    {newPassword && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Confirmer le nouveau mot de passe
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          placeholder="Confirmer le nouveau mot de passe"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(false);
                        setUsername(user?.username || '');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition font-semibold"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-blue-400 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Sauvegarde...' : 'Enregistrer'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom d'utilisateur</label>
                    <p className="text-gray-900 font-semibold">{username}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <p className="text-gray-900">{email}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Membre depuis
                    </label>
                    <p className="text-gray-900">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
