import { useEffect, useRef, useState } from 'react';
import type { DuelLogEntry } from '../../../../shared/duelView';

/**
 * Annonces plein écran : changement de tour, de phase, pioche.
 *
 * Pourquoi passer par le **journal** et non par l'état du plateau : entre deux
 * consultations, le moteur traverse souvent plusieurs phases d'un coup. La fin
 * d'un tour amène `end phase`, `turn`, `draw phase`, la pioche, puis
 * `main phase 1` — et l'état ne montrerait que la dernière. Le joueur verrait
 * son tour changer sans comprendre ce qui s'est passé entre-temps.
 *
 * Le journal, lui, garde chaque étape dans l'ordre. On le rejoue.
 */

/** Types de lignes qui méritent une annonce. Le reste va dans le journal latéral. */
const ANNOUNCED = new Set(['new_turn', 'new_phase', 'draw', 'win']);

const HOLD_MS = 950;

interface Announcement {
  key: number;
  kind: string;
  text: string;
}

export function PhaseAnnouncer({ log }: { log: DuelLogEntry[] }) {
  const [queue, setQueue] = useState<Announcement[]>([]);
  const [current, setCurrent] = useState<Announcement | null>(null);

  /**
   * Longueur du journal déjà annoncée.
   *
   * Le journal arrive tronqué à ses 60 dernières lignes : on ne peut donc pas
   * comparer des index absolus. On compte ce qu'on a déjà vu et on n'annonce
   * que le surplus.
   */
  const seen = useRef<number | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    if (seen.current === null) {
      // Premier rendu : on ne rejoue pas l'historique, on prend le fil en marche.
      seen.current = log.length;
      return;
    }
    if (log.length <= seen.current) {
      // Le journal a été tronqué ou réinitialisé (nouvelle partie).
      seen.current = log.length;
      return;
    }

    const fresh = log.slice(seen.current).filter((e) => ANNOUNCED.has(e.kind));
    seen.current = log.length;
    if (!fresh.length) return;

    setQueue((q) => [
      ...q,
      ...fresh.map((e) => ({ key: ++counter.current, kind: e.kind, text: e.text })),
    ]);
  }, [log]);

  // Défile une annonce à la fois : les empiler les rendrait illisibles.
  useEffect(() => {
    if (current || queue.length === 0) return;
    setCurrent(queue[0]);
    setQueue((q) => q.slice(1));
  }, [queue, current]);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setCurrent(null), HOLD_MS);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;

  const accent =
    current.kind === 'new_turn'
      ? 'var(--cyan)'
      : current.kind === 'win'
        ? 'var(--magenta)'
        : current.kind === 'draw'
          ? 'var(--violet)'
          : 'var(--gold)';

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        // Assombrit le plateau le temps de l'annonce, sans le masquer : on doit
        // continuer de voir ce qui bouge derrière.
        background: 'rgba(0,0,0,.55)',
        zIndex: 7000,
        // Aucune interception de clic : l'annonce passe, elle ne bloque pas.
        pointerEvents: 'none',
        animation: 'san-announce 950ms ease-out both',
      }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 44,
            fontWeight: 900,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: accent,
            textShadow: `0 0 30px ${accent}`,
          }}>
          {current.text}
        </div>
        <div
          style={{
            height: 2,
            marginTop: 12,
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          }}
        />
      </div>
    </div>
  );
}

export default PhaseAnnouncer;
