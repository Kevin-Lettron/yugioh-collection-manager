import { useEffect, useRef, useState } from 'react';
import {
  DebugErrorEntry,
  isDebugEnabled,
  onDebugError,
  setDebugEnabled,
} from '../utils/debugBus';
import { useAuth } from '../context/AuthContext';

/**
 * Panneau d'erreurs façon « WP_DEBUG_DISPLAY ».
 *
 * Affiche à l'écran les erreurs HTTP (via intercepteur axios), JS non
 * rattrapées (window.error) et promesses rejetées (unhandledrejection),
 * avec le message serveur brut, l'URL, le status, la stack et un bouton
 * pour tout copier. Toujours monté ; ne rend rien tant que le mode debug
 * n'est pas activé — voir `isDebugEnabled` pour l'activation.
 */

const MAX_ENTRIES = 40;
const KIND_LABELS: Record<DebugErrorEntry['kind'], { label: string; color: string }> = {
  http: { label: 'HTTP', color: '#ff6b6b' },
  js: { label: 'JS', color: '#ffb400' },
  promise: { label: 'PROMISE', color: '#ff8c00' },
  react: { label: 'REACT', color: '#c084fc' },
};

export default function DebugErrorOverlay() {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'moderator';
  const [manualEnabled, setManualEnabled] = useState<boolean>(() => isDebugEnabled());
  const [dismissed, setDismissed] = useState(false);
  // Actif automatiquement pour les admins/modérateurs (pas besoin de ?debug=1),
  // opt-in via URL/localStorage pour les autres, et coupable par le bouton ✕
  // pour la session courante (`dismissed`).
  const enabled = !dismissed && (isStaff || manualEnabled);
  const [entries, setEntries] = useState<DebugErrorEntry[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    return onDebugError((entry) => {
      if (seenIds.current.has(entry.id)) return;
      seenIds.current.add(entry.id);
      setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
    });
  }, [enabled]);

  // ?debug=1 change l'état sans recharger : on relit à chaque focus onglet.
  useEffect(() => {
    const check = () => setManualEnabled(isDebugEnabled());
    window.addEventListener('focus', check);
    window.addEventListener('storage', check);
    return () => {
      window.removeEventListener('focus', check);
      window.removeEventListener('storage', check);
    };
  }, []);

  if (!enabled) return null;

  const disable = () => {
    // Pour un admin, ✕ = masquer jusqu'à la prochaine reco (pas d'off durable
    // — sinon il faudrait un truc pour le réactiver). Pour un non-admin qui
    // a opt-in par l'URL, on coupe aussi le localStorage.
    setDismissed(true);
    if (!isStaff) {
      setDebugEnabled(false);
      setManualEnabled(false);
    }
  };

  const copyAll = () => {
    const dump = entries
      .map((e) => {
        const lines = [
          `[${new Date(e.ts).toISOString()}] ${KIND_LABELS[e.kind].label} · ${e.title}`,
          e.detail ? e.detail : '',
          e.stack ? `\n${e.stack}` : '',
          e.meta ? `\nmeta: ${JSON.stringify(e.meta, null, 2)}` : '',
        ].filter(Boolean);
        return lines.join('\n');
      })
      .join('\n\n─────────────\n\n');
    try {
      navigator.clipboard.writeText(dump);
    } catch {
      /* ignoré */
    }
  };

  const clear = () => {
    setEntries([]);
    seenIds.current.clear();
    setExpandedId(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        width: collapsed ? 200 : 460,
        maxHeight: '75vh',
        background: 'rgba(15, 15, 20, 0.96)',
        border: '1px solid #ff6b6b',
        borderRadius: 6,
        color: '#f5f5f5',
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: 11,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          background: '#1a0f0f',
          borderBottom: '1px solid #ff6b6b',
        }}
      >
        <strong style={{ color: '#ff6b6b', flex: 1 }}>
          ⚠ DEBUG ({entries.length})
        </strong>
        <button onClick={copyAll} style={btnStyle} title="Copier tout">
          Copier
        </button>
        <button onClick={clear} style={btnStyle} title="Vider la liste">
          Clear
        </button>
        <button
          onClick={() => setCollapsed((c) => !c)}
          style={btnStyle}
          title={collapsed ? 'Déplier' : 'Replier'}
        >
          {collapsed ? '▲' : '▼'}
        </button>
        <button onClick={disable} style={btnStyle} title="Désactiver le mode debug">
          ✕
        </button>
      </div>

      {!collapsed && (
        <div style={{ overflowY: 'auto', maxHeight: '70vh' }}>
          {entries.length === 0 && (
            <div style={{ padding: 12, opacity: 0.6 }}>
              Aucune erreur pour l'instant. L'overlay reste ouvert et écoute.
            </div>
          )}
          {entries.map((e) => {
            const isOpen = expandedId === e.id;
            const k = KIND_LABELS[e.kind];
            return (
              <div
                key={e.id}
                style={{
                  padding: '6px 10px',
                  borderBottom: '1px solid #2a2a30',
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedId(isOpen ? null : e.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      background: k.color,
                      color: '#000',
                      padding: '1px 6px',
                      borderRadius: 3,
                      fontWeight: 700,
                      fontSize: 10,
                    }}
                  >
                    {k.label}
                  </span>
                  <span style={{ opacity: 0.55, fontSize: 10 }}>
                    {new Date(e.ts).toLocaleTimeString()}
                  </span>
                  <span style={{ flex: 1, wordBreak: 'break-word' }}>{e.title}</span>
                </div>
                {isOpen && (
                  <div style={{ marginTop: 6, paddingLeft: 4 }}>
                    {e.detail && (
                      <pre style={preStyle}>{e.detail}</pre>
                    )}
                    {e.stack && (
                      <details open>
                        <summary style={{ cursor: 'pointer', opacity: 0.7 }}>
                          Stack
                        </summary>
                        <pre style={preStyle}>{e.stack}</pre>
                      </details>
                    )}
                    {e.meta && (
                      <details>
                        <summary style={{ cursor: 'pointer', opacity: 0.7 }}>
                          Meta
                        </summary>
                        <pre style={preStyle}>{JSON.stringify(e.meta, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #444',
  color: '#f5f5f5',
  padding: '2px 8px',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: 10,
  fontFamily: 'inherit',
};

const preStyle: React.CSSProperties = {
  margin: '4px 0',
  padding: 8,
  background: '#0a0a10',
  border: '1px solid #2a2a30',
  borderRadius: 3,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontSize: 10,
  color: '#e5e5e5',
  maxHeight: 240,
  overflow: 'auto',
};
