/**
 * Page /admin/logs — vue live des logs applicatifs (erreurs serveur, erreurs
 * front, warnings, crashs). Broadcast temps réel via socket (room `admin:logs`,
 * jointe automatiquement côté serveur pour les admins/moderators).
 *
 * Ouverte volontairement en nouvel onglet depuis la topbar : elle est faite
 * pour rester ouverte en second écran pendant qu'on travaille dans l'app.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { adminApi, AdminLog, AdminLogLevel, AdminLogSource } from '../services/api';
import socketService from '../services/socket';

type LevelFilter = 'all' | AdminLogLevel;
type SourceFilter = 'all' | AdminLogSource;

const LEVEL_CHIPS: { value: LevelFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'error', label: 'Errors' },
  { value: 'warn', label: 'Warnings' },
];

const SOURCE_CHIPS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'server', label: 'Server' },
  { value: 'client', label: 'Client' },
  { value: 'crash', label: 'Crash' },
  { value: 'http', label: 'HTTP' },
];

const MAX_DISPLAYED = 500;

/** Compare deux `id` BIGSERIAL renvoyés en string. */
function idGt(a: string, b: string): boolean {
  if (a.length !== b.length) return a.length > b.length;
  return a > b;
}

const AdminLogs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminLog | null>(null);
  const [pausedByScroll, setPausedByScroll] = useState(false);

  // `newIds` : ids reçus par socket, affichés avec un halo bleu qui fade au
  // bout de 3 s (pour attirer le regard sans polluer visuellement).
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const fadeTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Le scroll conteneur — utilisé pour la détection de pause quand l'user lit.
  const scrollRef = useRef<HTMLDivElement>(null);

  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator');

  // Guard : renvoie si pas admin.
  useEffect(() => {
    if (user && !isAdmin) {
      toast.error('Accès admin requis');
      navigate('/collection');
    }
  }, [user, isAdmin, navigate]);

  // Fetch initial + rechargement quand un filtre change.
  const fetchLogs = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const res = await adminApi.listLogs({
          level: levelFilter === 'all' ? undefined : levelFilter,
          source: sourceFilter === 'all' ? undefined : sourceFilter,
          search: search.trim() || undefined,
          limit: 200,
        });
        setLogs(res.logs);
      } catch {
        toast.error('Erreur chargement logs');
      } finally {
        setLoading(false);
      }
    },
    [levelFilter, sourceFilter, search]
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Abonnement WebSocket — le serveur émet `admin:log` sur la room `admin:logs`
  // à chaque insertion. Le socket est déjà connecté par NotificationContext.
  useEffect(() => {
    if (!live || !isAdmin) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    const handler = (log: AdminLog) => {
      // Applique les filtres client-side pour ne pas rompre la logique
      // d'affichage courante (l'utilisateur ne veut pas voir de logs "warn"
      // arriver s'il a filtré sur "error").
      if (levelFilter !== 'all' && log.level !== levelFilter) return;
      if (sourceFilter !== 'all' && log.source !== sourceFilter) return;
      const s = search.trim().toLowerCase();
      if (s && !log.message.toLowerCase().includes(s) && !(log.url || '').toLowerCase().includes(s)) {
        return;
      }

      setLogs((prev) => {
        // Déduplique par id — un rechargement + un push socket peuvent croiser.
        if (prev.some((p) => p.id === log.id)) return prev;
        const next = [log, ...prev];
        // Plafonne à MAX_DISPLAYED pour ne pas exploser la RAM du navigateur
        // en cas de tempête (bug qui logue 100/sec).
        return next.length > MAX_DISPLAYED ? next.slice(0, MAX_DISPLAYED) : next;
      });

      // Halo bleu qui s'estompe au bout de 3 s.
      setNewIds((prev) => new Set(prev).add(log.id));
      const existing = fadeTimersRef.current[log.id];
      if (existing) clearTimeout(existing);
      fadeTimersRef.current[log.id] = setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(log.id);
          return next;
        });
        delete fadeTimersRef.current[log.id];
      }, 3000);
    };

    socket.on('admin:log', handler);
    return () => {
      socket.off('admin:log', handler);
    };
  }, [live, isAdmin, levelFilter, sourceFilter, search]);

  // Nettoyage timers au démontage.
  useEffect(() => {
    return () => {
      for (const t of Object.values(fadeTimersRef.current)) clearTimeout(t);
      fadeTimersRef.current = {};
    };
  }, []);

  // Détection du scroll manuel : si l'user descend, on ne le remonte pas.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setPausedByScroll(el.scrollTop > 24);
        ticking = false;
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-scroll vers le haut à l'arrivée d'un nouveau log SI l'user n'est pas
  // en train de lire plus bas.
  useEffect(() => {
    if (pausedByScroll) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: 'smooth' });
  }, [logs, pausedByScroll]);

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
      toast.success(`${logs.length} log(s) copié(s) au format JSON`);
    } catch {
      toast.error('Copie impossible');
    }
  };

  const handleClear = () => {
    setLogs([]);
    setNewIds(new Set());
    toast.success('Affichage vidé (les logs restent en base)');
  };

  if (!user) return null;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tête compact et dense — cette page vit sur un second écran. */}
      <div className="bg-gray-900 text-white border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-none px-4 py-2 flex flex-wrap items-center gap-3">
          <h1 className="font-bold text-sm uppercase tracking-wider">
            <span aria-hidden>📜</span> Logs live
          </h1>
          <span className="text-xs text-gray-400">
            {logs.length} entrée(s){pausedByScroll && ' · défilement en pause'}
          </span>

          <div className="flex items-center gap-1 ml-auto">
            <label className="flex items-center gap-1 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={live}
                onChange={(e) => setLive(e.target.checked)}
                className="accent-green-500"
              />
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  live ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                }`}
              />
              Live
            </label>
            <button
              onClick={handleCopy}
              disabled={logs.length === 0}
              className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Copier tous les logs affichés au format JSON"
            >
              Copier
            </button>
            <button
              onClick={handleClear}
              disabled={logs.length === 0}
              className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Vider uniquement l'affichage — les logs restent en base"
            >
              Effacer
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="max-w-none px-4 pb-2 flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-gray-400 mr-1">Niveau :</span>
            {LEVEL_CHIPS.map((c) => (
              <button
                key={c.value}
                onClick={() => setLevelFilter(c.value)}
                className={`px-2 py-0.5 rounded transition ${
                  levelFilter === c.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400 mr-1">Source :</span>
            {SOURCE_CHIPS.map((c) => (
              <button
                key={c.value}
                onClick={() => setSourceFilter(c.value)}
                className={`px-2 py-0.5 rounded transition ${
                  sourceFilter === c.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher dans les messages ou URLs…"
            className="ml-auto flex-1 min-w-[180px] max-w-xs px-2 py-1 rounded bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: 'calc(100vh - 96px)' }}>
        {loading && logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Chargement…</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Aucun log à afficher{search || levelFilter !== 'all' || sourceFilter !== 'all' ? ' (filtres actifs)' : ''}
          </div>
        ) : (
          <table className="w-full text-xs font-mono">
            <thead className="bg-gray-100 text-gray-500 uppercase tracking-wider sticky top-0">
              <tr>
                <th className="py-1 px-2 text-left w-32">Heure</th>
                <th className="py-1 px-2 text-left w-16">Level</th>
                <th className="py-1 px-2 text-left w-20">Source</th>
                <th className="py-1 px-2 text-left">Message</th>
                <th className="py-1 px-2 text-left w-64">URL</th>
                <th className="py-1 px-2 text-left w-16">User</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const isNew = newIds.has(log.id);
                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelected(log)}
                    className={`border-b border-gray-200 cursor-pointer hover:bg-blue-50/40 transition-colors ${
                      isNew ? 'bg-blue-100/70' : ''
                    }`}
                    style={{ transition: 'background-color 1.2s ease-out' }}
                  >
                    <td className="py-1 px-2 text-gray-500 whitespace-nowrap">
                      {formatTime(log.created_at)}
                    </td>
                    <td className="py-1 px-2">
                      <LevelBadge level={log.level} />
                    </td>
                    <td className="py-1 px-2">
                      <SourceBadge source={log.source} />
                    </td>
                    <td
                      className="py-1 px-2 text-gray-800 max-w-0 truncate"
                      title={log.message}
                    >
                      {log.message}
                    </td>
                    <td className="py-1 px-2 text-gray-600 truncate max-w-0" title={log.url || ''}>
                      {log.url || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-1 px-2 text-gray-500">
                      {log.user_id ?? <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer / modal détail */}
      {selected && (
        <LogDetail log={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
};

// ─── COMPONENTS ────────────────────────────────────────────────────

const LevelBadge = ({ level }: { level: AdminLogLevel }) => {
  const map: Record<AdminLogLevel, string> = {
    error: 'bg-red-100 text-red-700 border-red-300',
    warn: 'bg-orange-100 text-orange-700 border-orange-300',
    info: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 border rounded text-[10px] uppercase font-bold ${map[level]}`}>
      {level}
    </span>
  );
};

const SourceBadge = ({ source }: { source: AdminLogSource }) => {
  const map: Record<AdminLogSource, string> = {
    server: 'bg-purple-100 text-purple-700',
    client: 'bg-blue-100 text-blue-700',
    crash: 'bg-red-100 text-red-700',
    http: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase ${map[source]}`}>
      {source}
    </span>
  );
};

const LogDetail = ({ log, onClose }: { log: AdminLog; onClose: () => void }) => {
  const copyOne = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(log, null, 2));
      toast.success('Log copié au format JSON');
    } catch {
      toast.error('Copie impossible');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <LevelBadge level={log.level} />
            <SourceBadge source={log.source} />
            <span className="text-xs text-gray-500">
              {new Date(log.created_at).toLocaleString('fr-FR')}
            </span>
            <span className="text-xs text-gray-400">#{log.id}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyOne}
              className="px-2 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300 transition"
            >
              Copier JSON
            </button>
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300 transition"
            >
              Fermer
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 space-y-4 text-sm">
          <section>
            <h3 className="text-xs uppercase font-bold text-gray-500 mb-1">Message</h3>
            <pre className="whitespace-pre-wrap break-words font-mono text-sm bg-gray-50 p-3 rounded border">
              {log.message}
            </pre>
          </section>

          {log.url && (
            <section>
              <h3 className="text-xs uppercase font-bold text-gray-500 mb-1">URL</h3>
              <pre className="whitespace-pre-wrap break-words font-mono text-xs bg-gray-50 p-2 rounded border">
                {log.url}
              </pre>
            </section>
          )}

          {log.user_id && (
            <section>
              <h3 className="text-xs uppercase font-bold text-gray-500 mb-1">User ID</h3>
              <pre className="font-mono text-xs bg-gray-50 p-2 rounded border">{log.user_id}</pre>
            </section>
          )}

          {log.stack && (
            <section>
              <h3 className="text-xs uppercase font-bold text-gray-500 mb-1">Stack</h3>
              <pre className="whitespace-pre-wrap break-words font-mono text-xs bg-red-50 p-3 rounded border border-red-200 max-h-96 overflow-auto">
                {log.stack}
              </pre>
            </section>
          )}

          <section>
            <h3 className="text-xs uppercase font-bold text-gray-500 mb-1">Meta</h3>
            <pre className="whitespace-pre-wrap break-words font-mono text-xs bg-gray-50 p-3 rounded border max-h-64 overflow-auto">
              {JSON.stringify(log.meta, null, 2)}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
};

// ─── UTILS ─────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

// idGt gardé exporté au cas où on l'utilise pour un futur `sinceId` — silence
// le lint sans le supprimer complètement.
void idGt;

export default AdminLogs;
