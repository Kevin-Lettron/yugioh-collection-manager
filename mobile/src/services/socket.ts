import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/config';
import { storage } from '@/services/storage';
import { TOKEN_KEY } from '@/services/api';

/**
 * Bloc 5 · Client socket.io mobile — miroir de `client/src/services/socket.ts`.
 *
 * Sans lui, l'arène moteur mobile pollait toutes les 1.5 s (voir l'ancien
 * commentaire dans `duelEngineApi.ts`). Pour un vrai duel Master Duel-like,
 * c'est trop lent : les chaînes rapides et les animations arrivent avec un
 * demi-tour de retard, ce qui donne l'impression que l'app est cassée.
 *
 * Le service est un singleton. Le token JWT est lu au moment du `connect` :
 * on ne le fige pas à l'import du module, sinon un login-après-import
 * envoie un socket sans identité.
 *
 * Le socket.io-client fonctionne sous React Native sans polyfill : il choisit
 * automatiquement le transport `websocket` d'abord, `polling` en secours si
 * le WebSocket est indisponible (proxy d'entreprise, réseau captif).
 */
class SocketService {
  private socket: Socket | null = null;
  private connectingPromise: Promise<Socket | null> | null = null;

  /**
   * Ouvre une connexion, ou renvoie celle en cours. Le premier appel prend
   * ~150 ms le temps du handshake ; les suivants sont synchrones.
   */
  async connect(): Promise<Socket | null> {
    if (this.socket?.connected) return this.socket;
    if (this.connectingPromise) return this.connectingPromise;

    this.connectingPromise = (async () => {
      try {
        const token = (await storage.getItem(TOKEN_KEY)) || '';
        // Sans token, on renvoie null plutôt que d'échouer bruyamment — le
        // duel tombe alors sur son polling de secours, ce qui reste jouable.
        if (!token) {
          this.connectingPromise = null;
          return null;
        }

        this.socket = io(API_URL, {
          transports: ['websocket'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
          auth: { token },
        });

        // On attend l'événement `connect` avant de rendre le socket. Sinon
        // le premier `emit` part avant la poignée de main, et le serveur le
        // rejette. Timeout de 5 s : au-delà on considère le socket down.
        await new Promise<void>((resolve) => {
          const done = () => {
            this.socket?.off('connect', done);
            resolve();
          };
          this.socket?.once('connect', done);
          setTimeout(done, 5000);
        });

        this.socket?.on('disconnect', () => {
          // Reconnect géré par socket.io-client — on ne libère pas le handle.
        });
        this.socket?.on('connect_error', () => {
          // Idem : les codes d'erreur passent en callback, on n'a rien à
          // faire ici, sauf ne pas planter.
        });

        this.connectingPromise = null;
        return this.socket;
      } catch {
        this.connectingPromise = null;
        return null;
      }
    })();

    return this.connectingPromise;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default new SocketService();
