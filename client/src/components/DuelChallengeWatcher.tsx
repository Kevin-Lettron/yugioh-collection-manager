import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { duelApi } from '../services/duelApi';
import { useAuth } from '../context/AuthContext';
import type { Duel } from '../../../shared/types';

/**
 * Surveille les duels depuis n'importe quelle page.
 *
 * Deux besoins que les pages ne peuvent pas couvrir, parce qu'ils doivent
 * fonctionner **partout** :
 *
 *   - un défi reçu doit se voir même si on est en train de trier sa collection ;
 *   - quand l'adversaire accepte, le challenger doit être emmené sur le duel.
 *     Sans ça, il reste sur sa page à attendre sans savoir que la partie a
 *     commencé, et l'autre joueur poireaute en face.
 *
 * Monté une fois, sous l'`AuthProvider`, à côté des routes.
 */
export function DuelChallengeWatcher() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState<Duel | null>(null);
  const [accepted, setAccepted] = useState<Duel | null>(null);
  const [busy, setBusy] = useState(false);

  const dismiss = useCallback(() => setIncoming(null), []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = duelApi.subscribeToChallenges({
      onChallenged: ({ duel }) => {
        // On ne s'annonce pas à soi-même : le challenger reçoit aussi
        // l'événement dans sa propre room.
        if (duel.opponent_id === user.id) setIncoming(duel);
      },
      onCancelled: ({ duelId }) =>
        setIncoming((cur) => (cur?.id === duelId ? null : cur)),
      onRejected: ({ duelId }) =>
        setIncoming((cur) => (cur?.id === duelId ? null : cur)),
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // `duel:accepted` est émis dans la salle du duel **et** dans celle du
    // challenger : c'est ce second envoi qui nous intéresse ici, puisque le
    // challenger n'a pas encore rejoint la salle du duel.
    const unsubscribe = duelApi.subscribeToAcceptance(({ duel }) => {
      setIncoming((cur) => (cur?.id === duel.id ? null : cur));
      // On ne téléporte pas de force : un joueur au milieu d'autre chose
      // détesterait ça. On propose, il décide.
      setAccepted(duel);
    });
    return unsubscribe;
  }, [user]);

  const accept = async () => {
    if (!incoming || busy) return;
    setBusy(true);
    // Le choix du deck se fait sur la page du duel : la proposer ici
    // demanderait de charger la liste des decks dans une notification.
    navigate(`/duels?accept=${incoming.id}`);
    setIncoming(null);
    setBusy(false);
  };

  const reject = async () => {
    if (!incoming || busy) return;
    setBusy(true);
    try {
      await duelApi.reject(incoming.id);
    } finally {
      setIncoming(null);
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 9000,
        display: 'grid',
        gap: 12,
        maxWidth: 340,
      }}>
      {accepted && (
        <Card
          accent="var(--cyan)"
          title="Duel accepté"
          body={`${accepted.opponent?.username ?? "L'adversaire"} a accepté ton défi.`}
          primaryLabel="Rejoindre l'arène"
          onPrimary={() => {
            navigate(`/duel/${accepted.id}`);
            setAccepted(null);
          }}
          secondaryLabel="Plus tard"
          onSecondary={() => setAccepted(null)}
        />
      )}

      {incoming && (
        <Card
          accent="var(--gold)"
          title="Défi reçu"
          body={`@${incoming.challenger?.username ?? 'Un duelliste'} te provoque en duel.`}
          primaryLabel="Accepter"
          onPrimary={accept}
          secondaryLabel="Refuser"
          onSecondary={reject}
          onDismiss={dismiss}
          busy={busy}
        />
      )}
    </div>
  );
}

interface CardProps {
  accent: string;
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
  onDismiss?: () => void;
  busy?: boolean;
}

function Card({
  accent,
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onDismiss,
  busy,
}: CardProps) {
  return (
    <div
      role="alert"
      style={{
        background: 'var(--panel)',
        border: `1px solid ${accent}`,
        borderLeftWidth: 3,
        padding: '14px 16px',
        boxShadow: 'var(--shadow-card-lg)',
        // Même biseau que les panneaux du reste du site.
        clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)',
        animation: 'san-slide-in 240ms cubic-bezier(.2,.8,.2,1) both',
      }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: accent,
          }}>
          {title}
        </span>
        <span style={{ flex: 1 }} />
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Ignorer"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
            }}>
            ×
          </button>
        )}
      </div>

      <p style={{ margin: '6px 0 12px', fontSize: 13, color: 'var(--text)' }}>{body}</p>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onPrimary}
          disabled={busy}
          style={{
            flex: 1,
            padding: '8px 10px',
            background: accent,
            color: 'var(--on-gold)',
            border: 'none',
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: busy ? 'wait' : 'pointer',
            clipPath: 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)',
          }}>
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={onSecondary}
          disabled={busy}
          style={{
            padding: '8px 12px',
            background: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: busy ? 'wait' : 'pointer',
          }}>
          {secondaryLabel}
        </button>
      </div>
    </div>
  );
}

export default DuelChallengeWatcher;
