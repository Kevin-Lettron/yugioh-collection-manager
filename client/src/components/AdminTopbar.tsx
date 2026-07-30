import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * WordPress-style admin bar, always visible at the top of every page
 * for users with admin or moderator role. Renders nothing for regular users.
 */
const AdminTopbar = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) return null;

  const isOnAdmin = location.pathname.startsWith('/admin');

  const links = [
    { to: '/admin?tab=dashboard', label: 'Dashboard', icon: '📊' },
    { to: '/admin?tab=users', label: 'Users', icon: '👥' },
    { to: '/admin?tab=decks', label: 'Decks', icon: '🃏' },
    { to: '/admin?tab=comments', label: 'Comments', icon: '💬' },
  ];

  return (
    <div className="bg-gray-900 text-gray-300 text-xs border-b border-gray-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-8 flex items-center justify-between gap-4">
        {/* Left side: admin logo + quick links */}
        <div className="flex items-center gap-1 sm:gap-3 min-w-0 overflow-x-auto">
          <Link
            to="/admin"
            className="flex items-center gap-1 font-semibold text-white hover:text-purple-300 transition shrink-0"
          >
            <span>⚙️</span>
            <span className="hidden sm:inline">Admin</span>
          </Link>

          <span className="text-gray-600 hidden sm:inline">|</span>

          <nav className="flex items-center gap-1 sm:gap-2">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-800 hover:text-white transition whitespace-nowrap"
              >
                <span>{link.icon}</span>
                <span className="hidden md:inline">{link.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side: user info + shortcut to public / admin */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isOnAdmin ? (
            <Link
              to="/collection"
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-800 hover:text-white transition"
              title="Retour au site"
            >
              <span>👁</span>
              <span>Voir le site</span>
            </Link>
          ) : (
            <Link
              to="/admin"
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-800 hover:text-white transition"
              title="Espace administration"
            >
              <span>⚙️</span>
              <span>Espace admin</span>
            </Link>
          )}

          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
              user.role === 'admin'
                ? 'bg-purple-800 text-purple-200'
                : 'bg-blue-800 text-blue-200'
            }`}
            title={`Connecté en tant que ${user.username}`}
          >
            {user.role}
          </span>

          <span className="hidden sm:inline text-gray-400 truncate max-w-[120px]" title={user.username}>
            {user.username}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AdminTopbar;
