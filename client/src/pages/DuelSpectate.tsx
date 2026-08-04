import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { duelEngineApi } from '../services/duelEngineApi';
import type { DuelStateResponse } from '../../../shared/duelView';
import socketService from '../services/socket';

/**
 * Vue spectateur — F7 du PLAN-DUEL-AMELIORATIONS.
 *
 * Lecture seule : aucune main visible, aucun prompt, aucune interaction. Le
 * plateau se redessine à chaque `duel:engine_update` reçu via socket, ou
 * toutes les 3 s en poll de secours. Le back garantit qu'aucun code de carte
 * privée ne passe la couche `spectate` — on peut donc afficher le snapshot
 * tel quel.
 *
 * Cette page reprend une géométrie simplifiée du plateau : deux plateaux
 * (l'adversaire en haut, le joueur en bas) avec ses zones monstre / magie
 * face visible uniquement, et les LP.
 */
export default function DuelSpectate() {
  const { id } = useParams<{ id: string }>();
  const duelId = Number(id);
  const navigate = useNavigate();

  const [state, setState] = useState<DuelStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(duelId)) return;
    try {
      const s = await duelEngineApi.spectate(duelId);
      setState(s);
      setError(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Duel non disponible';
      setError(msg);
    }
  }, [duelId]);

  useEffect(() => {
    load();
  }, [load]);

  // Socket : chaque changement d'état côté serveur déclenche un refresh.
  useEffect(() => {
    let attached: ReturnType<typeof socketService.getSocket> = null;
    const onUpdate = (data: { duelId: number }) => {
      if (data?.duelId === duelId) load();
    };
    const attach = (): boolean => {
      const socket = socketService.getSocket();
      if (!socket) return false;
      attached = socket;
      socket.emit('duel:join', { duelId });
      socket.on('duel:engine_update', onUpdate);
      return true;
    };
    const retry = attach() ? null : setInterval(() => {
      if (attach() && retry) clearInterval(retry);
    }, 500);
    // Poll de secours toutes les 3 s : le socket peut mourir, on veut que la
    // vue reste vivante.
    const poll = setInterval(load, 3_000);
    return () => {
      if (retry) clearInterval(retry);
      clearInterval(poll);
      if (!attached) return;
      attached.off('duel:engine_update', onUpdate);
      attached.emit('duel:leave', { duelId });
    };
  }, [duelId, load]);

  if (error) {
    return (
      <div style={pageStyle}>
        <h1>Impossible de regarder ce duel</h1>
        <p>{error}</p>
        <button onClick={() => navigate('/social')}>Retour</button>
      </div>
    );
  }
  if (!state) return <div style={pageStyle}>Chargement du duel…</div>;

  const { board, log, combatLog } = state;
  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Duel #{duelId} — Spectateur</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ opacity: 0.7 }}>
            {board.phase} · Tour {board.turn}
          </span>
          <button onClick={() => navigate('/social')}>Fermer</button>
        </div>
      </div>

      {/* Plateau adverse (haut) */}
      <PlayerBoard side={board.opponent} label="Joueur 2" isOpponent />
      {/* Plateau joueur (bas) */}
      <PlayerBoard side={board.me} label="Joueur 1" />

      {/* Journal court */}
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={panelStyle}>
          <h3 style={{ margin: '0 0 8px 0' }}>Déroulé</h3>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto' }}>
            {log.slice(-30).map((l, i) => (
              <li key={i} style={{ padding: '2px 0', fontSize: 12 }}>
                {l.text}
              </li>
            ))}
          </ul>
        </div>
        <div style={panelStyle}>
          <h3 style={{ margin: '0 0 8px 0' }}>Combat</h3>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto' }}>
            {(combatLog ?? []).slice(-20).map((c, i) => (
              <li key={i} style={{ padding: '2px 0', fontSize: 12 }}>
                {c.description}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {state.status === 'ended' && (
        <div style={{ marginTop: 16, padding: 16, background: 'rgba(212,160,23,0.2)', borderRadius: 8 }}>
          <p>
            <strong>Fin du duel</strong> — vainqueur : Joueur {state.winner !== null && state.winner !== undefined ? state.winner + 1 : '?'}
            {state.winReason ? ` (${state.winReason})` : ''}
          </p>
        </div>
      )}
    </div>
  );
}

function PlayerBoard({
  side,
  label,
  isOpponent = false,
}: {
  side: DuelStateResponse['board']['me'];
  label: string;
  isOpponent?: boolean;
}) {
  return (
    <div style={{ ...boardStyle, marginTop: 12, borderColor: isOpponent ? '#943' : '#396' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>{label}</strong>
        <span>{side.lp} LP · Main {side.handCount} · Deck {side.deckCount}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {side.monsters.map((z, i) => (
          <Slot key={`m${i}`} zone={z} />
        ))}
        {side.spells.map((z, i) => (
          <Slot key={`s${i}`} zone={z} />
        ))}
      </div>
    </div>
  );
}

function Slot({ zone }: { zone: DuelStateResponse['board']['me']['monsters'][number] }) {
  if (!zone) return <div style={{ ...slotStyle, background: 'rgba(0,0,0,0.15)' }} />;
  const img = zone.code
    ? `https://images.ygoprodeck.com/images/cards_small/${zone.code}.jpg`
    : null;
  return (
    <div style={slotStyle} title={zone.name}>
      {img && !zone.faceDown ? (
        <img
          src={img}
          alt={zone.name ?? ''}
          style={{ width: '100%', display: 'block', borderRadius: 3 }}
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
        />
      ) : (
        <div style={{ padding: 6, textAlign: 'center', fontSize: 10 }}>
          {zone.faceDown ? 'Face verso' : zone.name ?? '?'}
        </div>
      )}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 24,
  maxWidth: 1200,
  margin: '0 auto',
  color: 'inherit',
};

const boardStyle: React.CSSProperties = {
  padding: 12,
  border: '1px solid #333',
  borderRadius: 8,
  background: 'rgba(0,0,0,0.1)',
};

const slotStyle: React.CSSProperties = {
  minHeight: 70,
  border: '1px solid #333',
  borderRadius: 4,
  overflow: 'hidden',
};

const panelStyle: React.CSSProperties = {
  padding: 12,
  border: '1px solid #333',
  borderRadius: 8,
  background: 'rgba(0,0,0,0.1)',
};
