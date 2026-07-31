import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { adminApi, AdminStats, AdminUser, AdminDeck, AdminComment } from '../services/api';
import AppNavbar from '../components/AppNavbar';
import { useDebounce } from '../hooks/useDebounce';

type Tab = 'dashboard' | 'users' | 'decks' | 'comments';
const VALID_TABS: Tab[] = ['dashboard', 'users', 'decks', 'comments'];

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read tab from ?tab=xxx query param, default to dashboard
  const urlTab = searchParams.get('tab') as Tab | null;
  const tab: Tab = urlTab && VALID_TABS.includes(urlTab) ? urlTab : 'dashboard';

  const setTab = (newTab: Tab) => {
    setSearchParams({ tab: newTab }, { replace: true });
  };

  // Guard: redirect if not admin/moderator
  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'moderator') {
      toast.error('Accès admin requis');
      navigate('/collection');
    }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <AppNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Administration</h1>
          <p className="text-gray-600 mt-1">
            Connecté en tant que <span className="font-semibold">{user.username}</span> —
            rôle <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-semibold ml-1">{user.role}</span>
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6 overflow-x-auto">
          <nav className="-mb-px flex gap-4">
            {(['dashboard', 'users', 'decks', 'comments'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`whitespace-nowrap py-2 px-3 border-b-2 font-medium text-sm capitalize transition ${
                  tab === t
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t === 'dashboard' && '📊 '}
                {t === 'users' && '👥 '}
                {t === 'decks' && '🃏 '}
                {t === 'comments' && '💬 '}
                {t}
              </button>
            ))}
          </nav>
        </div>

        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'users' && <UsersTab currentUserId={user.id} />}
        {tab === 'decks' && <DecksTab />}
        {tab === 'comments' && <CommentsTab />}
      </div>
    </div>
  );
};

// ─── DASHBOARD TAB ───────────────────────────────────────────────

const DashboardTab = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.stats()
      .then(setStats)
      .catch(() => toast.error('Erreur chargement stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-8 text-gray-500">Chargement…</div>;
  if (!stats) return <div className="text-center py-8 text-gray-500">Erreur</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Utilisateurs" value={stats.users} color="blue" />
        <StatCard label="Actifs (7j)" value={stats.activeUsers7d} color="green" />
        <StatCard label="Decks" value={stats.decks} color="purple" />
        <StatCard label="Commentaires" value={stats.comments} color="orange" />
        <StatCard label="Cartes uniques" value={stats.uniqueCardEntries} color="indigo" />
        <StatCard label="Total cartes" value={stats.totalCardsInCollections} color="pink" />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Répartition par rôle</h3>
        <div className="space-y-2">
          {stats.roleBreakdown.map((r) => (
            <div key={r.role} className="flex justify-between items-center">
              <span className="text-gray-700 capitalize">{r.role}</span>
              <span className="font-mono font-semibold">{r.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">5 derniers inscrits</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500 text-left">
                <th className="py-2">ID</th>
                <th className="py-2">Username</th>
                <th className="py-2">Email</th>
                <th className="py-2">Rôle</th>
                <th className="py-2">Inscrit le</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentSignups.map((u) => (
                <tr key={u.id} className="border-b">
                  <td className="py-2">{u.id}</td>
                  <td className="py-2 font-medium">{u.username}</td>
                  <td className="py-2 text-gray-600">{u.email}</td>
                  <td className="py-2">
                    <span className={roleBadge(u.role)}>{u.role}</span>
                  </td>
                  <td className="py-2 text-gray-500">
                    {new Date(u.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    pink: 'bg-pink-50 text-pink-700 border-pink-200',
  };
  return (
    <div className={`p-4 rounded-lg border ${colors[color]}`}>
      <p className="text-xs uppercase font-semibold opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value.toLocaleString('fr-FR')}</p>
    </div>
  );
};

const roleBadge = (role: string): string => {
  const base = 'inline-block px-2 py-0.5 rounded text-xs font-semibold';
  if (role === 'admin') return `${base} bg-purple-100 text-purple-700`;
  if (role === 'moderator') return `${base} bg-blue-100 text-blue-700`;
  return `${base} bg-gray-100 text-gray-600`;
};

// ─── USERS TAB ───────────────────────────────────────────────────

const UsersTab = ({ currentUserId }: { currentUserId: number }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 400);

  const fetchUsers = () => {
    setLoading(true);
    adminApi.listUsers({ page, limit: 25, search: debouncedSearch, role: roleFilter })
      .then((r) => {
        setUsers(r.users);
        setTotal(r.total);
      })
      .catch(() => toast.error('Erreur chargement users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [page, debouncedSearch, roleFilter]);

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await adminApi.updateUserRole(userId, newRole as any);
      toast.success('Rôle mis à jour');
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur');
    }
  };

  const handleToggleActive = async (userId: number, username: string, currentlyActive: boolean) => {
    const action = currentlyActive ? 'Désactiver' : 'Réactiver';
    const nextState = !currentlyActive;
    const message = currentlyActive
      ? `Désactiver ${username} ?\n\nSon compte sera bloqué immédiatement (ses tokens actuels ne fonctionneront plus, il ne pourra plus se connecter). Ses données restent intactes — action réversible.`
      : `Réactiver ${username} ?\n\nIl pourra à nouveau se connecter.`;
    if (!confirm(message)) return;
    try {
      await adminApi.toggleUserActive(userId, nextState);
      toast.success(`${username} ${nextState ? 'réactivé' : 'désactivé'}`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || `Erreur ${action}`);
    }
  };

  const handleDelete = async (userId: number, username: string) => {
    if (!confirm(`⚠️ SUPPRESSION DÉFINITIVE ⚠️\n\nSupprimer ${username} ?\n\nToutes ses données (decks, cartes, commentaires) seront PERDUES.\n\nSi tu veux juste bloquer son accès temporairement, utilise "Désactiver" à la place.\n\nAction IRRÉVERSIBLE. Tape OK pour confirmer.`)) return;
    try {
      await adminApi.deleteUser(userId);
      toast.success(`${username} supprimé`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Rechercher par username ou email…"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">Tous les rôles</option>
          <option value="admin">Admin</option>
          <option value="moderator">Moderator</option>
          <option value="user">User</option>
        </select>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Chargement…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="py-2 px-3 text-left">ID</th>
                <th className="py-2 px-3 text-left">Username</th>
                <th className="py-2 px-3 text-left">Email</th>
                <th className="py-2 px-3 text-left">Rôle</th>
                <th className="py-2 px-3 text-left">Statut</th>
                <th className="py-2 px-3 text-right">Decks</th>
                <th className="py-2 px-3 text-right">Cartes</th>
                <th className="py-2 px-3 text-left">Inscrit</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={`border-b hover:bg-gray-50 ${!u.is_active ? 'opacity-60 bg-red-50/30' : ''}`}
                >
                  <td className="py-2 px-3">{u.id}</td>
                  <td className="py-2 px-3 font-medium">{u.username}</td>
                  <td className="py-2 px-3 text-gray-600">{u.email}</td>
                  <td className="py-2 px-3">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={u.id === currentUserId}
                      className={`text-xs px-2 py-1 rounded border ${
                        u.role === 'admin' ? 'bg-purple-50 border-purple-300' :
                        u.role === 'moderator' ? 'bg-blue-50 border-blue-300' :
                        'bg-gray-50 border-gray-300'
                      } disabled:opacity-50`}
                    >
                      <option value="user">user</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    {u.is_active ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-semibold">
                        Actif
                      </span>
                    ) : (
                      <span
                        className="inline-block px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-semibold"
                        title={u.disabled_at ? `Désactivé le ${new Date(u.disabled_at).toLocaleString('fr-FR')}` : ''}
                      >
                        Désactivé
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">{u.deck_count}</td>
                  <td className="py-2 px-3 text-right font-mono">{u.card_count}</td>
                  <td className="py-2 px-3 text-gray-500 text-xs">
                    {new Date(u.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="py-2 px-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(u.id, u.username, u.is_active)}
                      disabled={u.id === currentUserId}
                      className={`text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed ${
                        u.is_active ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'
                      }`}
                      title={u.is_active
                        ? 'Bloque le login, préserve les données (réversible)'
                        : 'Réactive le compte'}
                    >
                      {u.is_active ? 'Désactiver' : 'Réactiver'}
                    </button>
                    <button
                      onClick={() => handleDelete(u.id, u.username)}
                      disabled={u.id === currentUserId}
                      className="text-red-600 hover:text-red-800 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Suppression définitive avec toutes les données"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination total={total} page={page} limit={25} onChange={setPage} />
    </div>
  );
};

// ─── DECKS TAB ───────────────────────────────────────────────────

const DecksTab = () => {
  const [decks, setDecks] = useState<AdminDeck[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 400);

  const fetchDecks = () => {
    setLoading(true);
    adminApi.listDecks({ page, limit: 25, search: debouncedSearch })
      .then((r) => { setDecks(r.decks); setTotal(r.total); })
      .catch(() => toast.error('Erreur chargement decks'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDecks(); }, [page, debouncedSearch]);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Supprimer le deck "${name}" ?`)) return;
    try {
      await adminApi.deleteDeck(id);
      toast.success(`Deck "${name}" supprimé`);
      fetchDecks();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur');
    }
  };

  const handleUnshare = async (id: number, name: string) => {
    if (!confirm(`Rendre privé et casser le lien de partage pour "${name}" ?`)) return;
    try {
      await adminApi.forceUnshareDeck(id);
      toast.success('Deck rendu privé');
      fetchDecks();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Rechercher par nom de deck ou username…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
        />
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Chargement…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="py-2 px-3 text-left">ID</th>
                <th className="py-2 px-3 text-left">Nom</th>
                <th className="py-2 px-3 text-left">Propriétaire</th>
                <th className="py-2 px-3 text-left">Visibilité</th>
                <th className="py-2 px-3 text-right">Cartes</th>
                <th className="py-2 px-3 text-right">👍</th>
                <th className="py-2 px-3 text-right">💬</th>
                <th className="py-2 px-3 text-left">Créé</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {decks.map((d) => (
                <tr key={d.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3">{d.id}</td>
                  <td className="py-2 px-3 font-medium">{d.name}</td>
                  <td className="py-2 px-3">
                    <span>{d.username}</span>
                    {d.user_role !== 'user' && (
                      <span className={`ml-1 ${roleBadge(d.user_role)}`}>{d.user_role}</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {d.is_public && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">public</span>}
                    {d.is_shared && <span className="ml-1 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">shared</span>}
                    {!d.is_public && !d.is_shared && <span className="text-xs text-gray-500">privé</span>}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">{d.card_count}</td>
                  <td className="py-2 px-3 text-right font-mono">{d.likes}</td>
                  <td className="py-2 px-3 text-right font-mono">{d.comments}</td>
                  <td className="py-2 px-3 text-gray-500 text-xs">
                    {new Date(d.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="py-2 px-3 text-right space-x-2 whitespace-nowrap">
                    {d.is_shared && (
                      <button
                        onClick={() => handleUnshare(d.id, d.name)}
                        className="text-orange-600 hover:text-orange-800 text-xs font-semibold"
                      >
                        Unshare
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(d.id, d.name)}
                      className="text-red-600 hover:text-red-800 text-xs font-semibold"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination total={total} page={page} limit={25} onChange={setPage} />
    </div>
  );
};

// ─── COMMENTS TAB ────────────────────────────────────────────────

const CommentsTab = () => {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 400);

  const fetch = () => {
    setLoading(true);
    adminApi.listComments({ page, limit: 25, search: debouncedSearch })
      .then((r) => { setComments(r.comments); setTotal(r.total); })
      .catch(() => toast.error('Erreur chargement comments'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [page, debouncedSearch]);

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce commentaire (et ses réponses éventuelles) ?')) return;
    try {
      await adminApi.deleteComment(id);
      toast.success('Commentaire supprimé');
      fetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Rechercher dans les commentaires ou par username…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
        />
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Chargement…</div>
      ) : (
        <div className="divide-y">
          {comments.map((c) => (
            <div key={c.id} className="p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <span className="font-semibold text-gray-700">{c.username}</span>
                    <span>sur</span>
                    <span className="font-medium text-gray-700">{c.deck_name}</span>
                    <span>·</span>
                    <span>{new Date(c.created_at).toLocaleString('fr-FR')}</span>
                    {c.parent_comment_id && <span className="text-blue-600">↳ réponse</span>}
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{c.content}</p>
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="shrink-0 text-red-600 hover:text-red-800 text-xs font-semibold px-2"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <div className="p-8 text-center text-gray-500">Aucun commentaire</div>
          )}
        </div>
      )}

      <Pagination total={total} page={page} limit={25} onChange={setPage} />
    </div>
  );
};

// ─── PAGINATION ──────────────────────────────────────────────────

const Pagination = ({
  total, page, limit, onChange
}: { total: number; page: number; limit: number; onChange: (p: number) => void }) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="p-3 border-t flex justify-between items-center text-sm text-gray-600">
      <span>{total} résultat{total > 1 ? 's' : ''}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 border rounded disabled:opacity-30"
        >
          ← Préc.
        </button>
        <span>Page {page} / {totalPages}</span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 border rounded disabled:opacity-30"
        >
          Suiv. →
        </button>
      </div>
    </div>
  );
};

export default Admin;
