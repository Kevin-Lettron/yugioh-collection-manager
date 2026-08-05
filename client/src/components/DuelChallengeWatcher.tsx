import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { duelApi } from '../services/duelApi';
import { useAuth } from '../context/AuthContext';

/**
 * Surveille les evenements de duel depuis n'importe quelle page.
 *
 * Deux besoins qu'une page ne peut pas couvrir a elle seule, parce qu'ils
 * doivent fonctionner **partout** :
 *
 *   1. Un defi recu doit se voir meme si on est en train de trier sa collection.
 *      Sinon l'adversaire clique "Defier" et rien ne se passe visuellement chez
 *      la cible : elle croit que l'appli est cassee et le challenger poireaute.
 *
 *   2. Quand l'adversaire accepte, le challenger doit atterrir automatiquement
 *      sur `/duel/:id`. Sans ca, il reste sur sa page a rafraichir /duels a la
 *      main pendant que l'autre joueur attend seul dans l'arene.
 *
 * Monte une fois, sous l'`AuthProvider`, a cote des routes. On passe par
 * `react-hot-toast` pour beneficier de l'animation et de la file d'attente
 * partagees avec le reste de l'app (le <Toaster/> est deja monte dans App).
 */
export function DuelChallengeWatcher() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Ecoute des defis entrants.
  useEffect(() => {
    if (!user) return;

    const unsubscribe = duelApi.subscribeToChallenges({
      onChallenged: ({ duel }) => {
        // Filet de securite : le back emet uniquement dans la room
        // `user:${opponentId}`, mais on double-check pour ne rien afficher au
        // challenger qui aurait recu l'event par erreur.
        if (duel.opponent_id !== user.id) return;

        const challengerName = duel.challenger?.username ?? 'Un duelliste';
        const toastId = `duel-challenge-${duel.id}`;

        toast.custom(
          (t) => (
            <div
              role="alert"
              style={{
                background: 'var(--panel)',
                color: 'var(--text)',
                border: '1px solid var(--gold)',
                borderLeftWidth: 3,
                padding: '14px 16px',
                boxShadow: 'var(--shadow-card-lg, 0 12px 32px rgba(0,0,0,.45))',
                clipPath:
                  'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)',
                minWidth: 280,
                maxWidth: 340,
                animation: t.visible
                  ? 'san-slide-in 240ms cubic-bezier(.2,.8,.2,1) both'
                  : undefined,
              }}>
              <div
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--gold)',
                }}>
                Defi recu
              </div>
              <p style={{ margin: '6px 0 12px', fontSize: 13, color: 'var(--text)' }}>
                @{challengerName} te defie en duel.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    toast.dismiss(t.id);
                    // On envoie sur /duels : l'onglet "En attente" y liste le
                    // defi, avec le bouton "Accepter" qui ouvre le choix du
                    // deck. Rediriger direct sur le duel avant acceptation
                    // n'a pas de sens : /duel/:id attend un duel actif.
                    navigate('/duels');
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    background: 'var(--gold)',
                    color: 'var(--on-gold, #0b0906)',
                    border: 'none',
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    clipPath:
                      'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)',
                  }}>
                  Voir
                </button>
                <button
                  type="button"
                  onClick={() => toast.dismiss(t.id)}
                  style={{
                    padding: '8px 12px',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}>
                  Ignorer
                </button>
              </div>
            </div>
          ),
          { id: toastId, duration: 12_000, position: 'top-right' }
        );
      },
      // Si le challenger annule ou l'user refuse depuis la page /duels,
      // on ferme le toast eventuellement encore visible.
      onCancelled: ({ duelId }) => toast.dismiss(`duel-challenge-${duelId}`),
      onRejected: ({ duelId }) => toast.dismiss(`duel-challenge-${duelId}`),
    });

    return unsubscribe;
  }, [user, navigate]);

  // Auto-redirect du challenger quand l'adversaire accepte.
  useEffect(() => {
    if (!user) return;

    const unsubscribe = duelApi.subscribeToAcceptance(({ duel }) => {
      // Le back emet aussi `duel:accepted` dans la room `duel:${id}` — mais
      // l'accepteur (P2) vient tout juste d'appeler l'API, il n'a pas rejoint
      // cette room et n'a d'ailleurs pas besoin d'etre redirige : il navigue
      // deja de sa propre initiative. Filet de securite quand meme : on ne
      // redirige que si l'user courant est bien le challenger.
      if (duel.challenger_id !== user.id) return;

      const opponentName = duel.opponent?.username ?? "L'adversaire";
      // Ferme un eventuel toast "Defi recu" residuel avant de partir.
      toast.dismiss(`duel-challenge-${duel.id}`);
      toast.success(`@${opponentName} a accepte ton defi — direction l'arene`, {
        duration: 3000,
      });
      navigate(`/duel/${duel.id}`);
    });

    return unsubscribe;
  }, [user, navigate]);

  return null;
}

export default DuelChallengeWatcher;
