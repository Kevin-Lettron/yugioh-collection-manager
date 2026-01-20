import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User } from '../../../shared/types';
import api from '../services/api';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user, logout, updateUser } = useAuth();
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
        api.get('/collection/cards', { params: { limit: 1 } }),
        api.get('/decks', { params: { limit: 1 } }),
        api.get('/social/followers'),
        api.get('/social/following'),
      ]);

      setStats({
        totalCards: cardsRes.data.total || 0,
        totalDecks: decksRes.data.total || decksRes.data.length || 0,
        followersCount: followersRes.data.length || 0,
        followingCount: followingRes.data.length || 0,
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
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setUploading(true);
    try {
      const response = await api.post('/auth/profile/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const updatedUser: User = response.data;
      setProfilePicture(updatedUser.profile_picture || '');
      updateUser(updatedUser);
      toast.success('Profile picture updated!');
    } catch (error) {
      console.error('Failed to upload avatar:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      toast.error('Username is required');
      return;
    }

    if (username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
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
      toast.success('Profile updated successfully!');
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
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-blue-600">YuGiOh Manager</h1>
              <div className="hidden md:flex space-x-4">
                <Link to="/collection" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md">
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
              <Link to="/profile" className="text-blue-600 font-semibold">
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">My Profile</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column - Profile Info */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              {/* Avatar */}
              <div className="text-center mb-6">
                <div className="relative inline-block">
                  {profilePicture ? (
                    <img
                      src={profilePicture}
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
                </div>

                <label className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition cursor-pointer">
                  {uploading ? 'Uploading...' : 'Change Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>

              {/* Stats */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-2xl font-bold text-gray-800 text-center">{stats.totalCards}</p>
                  <p className="text-sm text-gray-600 text-center">Cards in Collection</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-2xl font-bold text-gray-800 text-center">{stats.totalDecks}</p>
                  <p className="text-sm text-gray-600 text-center">Decks Created</p>
                </div>

                <Link to="/followers" className="block">
                  <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-lg font-bold text-gray-800">{stats.followersCount}</p>
                        <p className="text-xs text-gray-600">Followers</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-800">{stats.followingCount}</p>
                        <p className="text-xs text-gray-600">Following</p>
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
                <h3 className="text-xl font-bold text-gray-800">Account Information</h3>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
                  >
                    Edit Profile
                  </button>
                )}
              </div>

              {editing ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="Username"
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
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h4 className="font-semibold text-gray-800 mb-4">Change Password (Optional)</h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        placeholder="Leave blank to keep current password"
                      />
                    </div>

                    {newPassword && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          placeholder="Confirm new password"
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
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-blue-400 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <p className="text-gray-900 font-semibold">{username}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <p className="text-gray-900">{email}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Member Since
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
