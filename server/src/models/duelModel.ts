import { query } from '../config/database';
import {
  Duel,
  DuelPhase,
  DuelStatus,
  DeckCard,
  PlayerBoardState,
  DuelChatMessage,
} from '../../../shared/types';
import { DeckModel } from './deckModel';

/**
 * Fisher-Yates shuffle immuable — meme algorithme que le playtester DeckView cote client.
 * Math.random() est autorise cote back (contrairement aux workflow scripts).
 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Explose chaque DeckCard en `quantity` instances de quantity=1 pour shuffle atomique. */
function expandDeck(cards: DeckCard[]): DeckCard[] {
  return cards.flatMap((dc) =>
    Array.from({ length: dc.quantity }, () => ({ ...dc, quantity: 1 }))
  );
}

function emptyBoardState(): Omit<PlayerBoardState, 'hand' | 'deck'> {
  return {
    monsters: [null, null, null, null, null],
    spellTraps: [null, null, null, null, null],
    field: null,
    graveyard: [],
    banished: [],
  };
}

function buildInitialState(mainDeck: DeckCard[]): PlayerBoardState {
  const shuffled = shuffle(expandDeck(mainDeck));
  return {
    hand: shuffled.slice(0, 5),
    deck: shuffled.slice(5),
    ...emptyBoardState(),
  };
}

/**
 * Serialise une ligne DB en Duel typé. Les colonnes JSONB reviennent deja
 * en objet js (pg fait le parse), il suffit de reetiqueter.
 */
function rowToDuel(row: any): Duel {
  const duel: Duel = {
    id: row.id,
    challenger_id: row.challenger_id,
    opponent_id: row.opponent_id,
    challenger_deck_id: row.challenger_deck_id,
    opponent_deck_id: row.opponent_deck_id,
    status: row.status as DuelStatus,
    winner_id: row.winner_id,
    first_player_id: row.first_player_id,
    current_turn_player_id: row.current_turn_player_id,
    current_phase: (row.current_phase as DuelPhase | null) ?? null,
    turn_number: row.turn_number,
    challenger_lp: row.challenger_lp,
    opponent_lp: row.opponent_lp,
    challenger_state: row.challenger_state ?? null,
    opponent_state: row.opponent_state ?? null,
    chat_log: row.chat_log ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    finished_at: row.finished_at,
    // Migration 010 — pile ou face.
    coin_flip_winner_id: row.coin_flip_winner_id ?? null,
    coin_flip_choice: (row.coin_flip_choice as 'P1' | 'P2' | null) ?? null,
    phase_pre_game: row.phase_pre_game ?? null,
    // Migration 011 — chess-clock. Les valeurs par défaut sont posées en base.
    p1_clock_ms: row.p1_clock_ms ?? 1500000,
    p2_clock_ms: row.p2_clock_ms ?? 1500000,
    clock_started_at: row.clock_started_at ?? null,
    clock_running_for: row.clock_running_for ?? null,
    // Migration 012 — match Bo3.
    match_id: row.match_id ?? null,
    game_number: row.game_number ?? 1,
    // Migration 009 — engine_mode : drapeau qui indique que ce duel se joue
    // par ygopro-core (côté mobile, ça détermine vers quelle arène rediriger).
    engine_mode: row.engine_mode === true,
    // Migration 014 — flags "prêt" du lobby (salle d'attente pré-coin-flip).
    challenger_ready: row.challenger_ready === true,
    opponent_ready: row.opponent_ready === true,
    // Migration 016 — regles de partie : 'standard' (banlist) ou 'free'.
    rules_mode: (row.rules_mode as 'standard' | 'free') ?? 'standard',
  } as Duel;

  if (row.challenger_username) {
    duel.challenger = {
      id: row.challenger_id,
      username: row.challenger_username,
      profile_picture: row.challenger_profile_picture,
    };
  }
  if (row.opponent_username) {
    duel.opponent = {
      id: row.opponent_id,
      username: row.opponent_username,
      profile_picture: row.opponent_profile_picture,
    };
  }
  return duel;
}

const SELECT_WITH_USERS = `
  SELECT d.*,
         cu.username         AS challenger_username,
         cu.profile_picture  AS challenger_profile_picture,
         ou.username         AS opponent_username,
         ou.profile_picture  AS opponent_profile_picture
    FROM duels d
    JOIN users cu ON cu.id = d.challenger_id
    JOIN users ou ON ou.id = d.opponent_id
`;

export interface DuelStatePatch {
  challenger_state?: PlayerBoardState;
  opponent_state?: PlayerBoardState;
  challenger_lp?: number;
  opponent_lp?: number;
  current_phase?: DuelPhase | null;
  turn_number?: number;
  current_turn_player_id?: number | null;
  chat_log?: DuelChatMessage[];
}

export class DuelModel {
  /**
   * Cree un duel en attente. Les states sont NULL — ils seront initialises a `accept`.
   */
  static async create(
    challengerId: number,
    opponentId: number,
    challengerDeckId?: number | null,
    rulesMode: 'standard' | 'free' = 'standard'
  ): Promise<Duel> {
    const result = await query(
      `INSERT INTO duels (challenger_id, opponent_id, challenger_deck_id, status, rules_mode)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING id`,
      [challengerId, opponentId, challengerDeckId ?? null, rulesMode]
    );
    const created = await this.findById(result.rows[0].id);
    // findById retourne toujours quelque chose ici puisqu'on vient de l'inserer
    return created as Duel;
  }

  /**
   * Recupere un duel avec les usernames/avatars des deux joueurs.
   */
  static async findById(id: number): Promise<Duel | null> {
    const result = await query(`${SELECT_WITH_USERS} WHERE d.id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return rowToDuel(result.rows[0]);
  }

  /**
   * Existe-t-il deja un duel pending entre ces deux users (peu importe le sens) ?
   * Sert a bloquer les challenges en double.
   */
  static async findPendingBetween(userAId: number, userBId: number): Promise<Duel | null> {
    const result = await query(
      `SELECT id
         FROM duels
        WHERE status = 'pending'
          AND ((challenger_id = $1 AND opponent_id = $2)
            OR (challenger_id = $2 AND opponent_id = $1))
        LIMIT 1`,
      [userAId, userBId]
    );
    if (result.rows.length === 0) return null;
    return this.findById(result.rows[0].id);
  }

  /**
   * Liste des duels ou l'user est challenger ou opponent, optionnellement filtres par status.
   * Ordre : les plus recents en premier.
   */
  static async listByUser(userId: number, status?: DuelStatus): Promise<Duel[]> {
    const params: any[] = [userId];
    let statusClause = '';
    if (status) {
      params.push(status);
      statusClause = 'AND d.status = $2';
    }
    const result = await query(
      `${SELECT_WITH_USERS}
        WHERE (d.challenger_id = $1 OR d.opponent_id = $1)
          ${statusClause}
        ORDER BY d.updated_at DESC`,
      params
    );
    return result.rows.map(rowToDuel);
  }

  /**
   * Accepte un duel : charge les 2 decks, initialise les states (main de 5),
   * tire aleatoirement le premier joueur, passe status='active'.
   *
   * Renvoie null si :
   *  - le duel n'existe pas ou n'est plus en pending
   *  - le challenger n'a pas choisi de deck (challenger_deck_id NULL)
   *  - l'un des deux decks est introuvable ou vide
   */
  static async accept(id: number, opponentDeckId: number): Promise<Duel | null> {
    const duel = await this.findById(id);
    if (!duel || duel.status !== 'pending') return null;
    if (!duel.challenger_deck_id) return null;

    const [challengerDeck, opponentDeck] = await Promise.all([
      DeckModel.findById(duel.challenger_deck_id),
      DeckModel.findById(opponentDeckId),
    ]);

    if (!challengerDeck?.main_deck?.length) return null;
    if (!opponentDeck?.main_deck?.length) return null;

    const challengerState = buildInitialState(challengerDeck.main_deck);
    const opponentState = buildInitialState(opponentDeck.main_deck);

    // Premier joueur tire au sort (0 = challenger, 1 = opponent).
    const firstPlayerId =
      Math.floor(Math.random() * 2) === 0 ? duel.challenger_id : duel.opponent_id;

    await query(
      `UPDATE duels
          SET status = 'active',
              opponent_deck_id = $1,
              challenger_state = $2::jsonb,
              opponent_state = $3::jsonb,
              first_player_id = $4,
              current_turn_player_id = $4,
              current_phase = 'draw',
              turn_number = 1,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $5`,
      [
        opponentDeckId,
        JSON.stringify(challengerState),
        JSON.stringify(opponentState),
        firstPlayerId,
        id,
      ]
    );

    return this.findById(id);
  }

  /**
   * Marque un duel refuse (par l'opponent).
   */
  static async reject(id: number): Promise<boolean> {
    const result = await query(
      `UPDATE duels
          SET status = 'cancelled',
              finished_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'pending'
        RETURNING id`,
      [id]
    );
    return result.rows.length > 0;
  }

  /**
   * Annulation par le challenger avant acceptation.
   */
  static async cancel(id: number): Promise<boolean> {
    return this.reject(id);
  }

  /**
   * Update partiel : uniquement les colonnes fournies dans le patch sont ecrites.
   * Sert au controller apres chaque action (draw/place/end_turn/chat/...).
   */
  static async updateState(id: number, patch: DuelStatePatch): Promise<Duel | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (patch.challenger_state !== undefined) {
      fields.push(`challenger_state = $${i++}::jsonb`);
      values.push(JSON.stringify(patch.challenger_state));
    }
    if (patch.opponent_state !== undefined) {
      fields.push(`opponent_state = $${i++}::jsonb`);
      values.push(JSON.stringify(patch.opponent_state));
    }
    if (patch.challenger_lp !== undefined) {
      fields.push(`challenger_lp = $${i++}`);
      values.push(patch.challenger_lp);
    }
    if (patch.opponent_lp !== undefined) {
      fields.push(`opponent_lp = $${i++}`);
      values.push(patch.opponent_lp);
    }
    if (patch.current_phase !== undefined) {
      fields.push(`current_phase = $${i++}`);
      values.push(patch.current_phase);
    }
    if (patch.turn_number !== undefined) {
      fields.push(`turn_number = $${i++}`);
      values.push(patch.turn_number);
    }
    if (patch.current_turn_player_id !== undefined) {
      fields.push(`current_turn_player_id = $${i++}`);
      values.push(patch.current_turn_player_id);
    }
    if (patch.chat_log !== undefined) {
      fields.push(`chat_log = $${i++}::jsonb`);
      values.push(JSON.stringify(patch.chat_log));
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    await query(
      `UPDATE duels SET ${fields.join(', ')} WHERE id = $${i}`,
      values
    );

    return this.findById(id);
  }

  /**
   * Fait basculer un duel de `pre_game` (pile ou face résolu) vers `active`.
   *
   * On n'écrase pas `first_player_id`, `coin_flip_*` ni `phase_pre_game` —
   * `seatOf` en dépend pour toute la partie. Idempotent : si le duel est déjà
   * `active` on ne fait rien.
   */
  static async setActiveAfterPreGame(id: number): Promise<void> {
    await query(
      `UPDATE duels
          SET status = 'active',
              current_phase = COALESCE(current_phase, 'draw'),
              current_turn_player_id = first_player_id,
              turn_number = COALESCE(NULLIF(turn_number, 0), 1),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status IN ('pre_game', 'pending')`,
      [id]
    );
  }

  // ─── Migration 014 · salle d'attente (change-deck + ready) ──────────────

  /**
   * Change le deck d'un joueur pendant le lobby.
   *
   * Autorisé UNIQUEMENT tant que :
   *  - `phase_pre_game` n'est pas posé (pas encore de coin flip)
   *  - le joueur concerné n'a pas encore cliqué « Prêt »
   *  - `status` ∈ ('pending', 'active')
   *
   * Renvoie le duel mis à jour, ou `null` si la transition n'est pas autorisée.
   * Idempotent : un même deck posé deux fois ne casse rien.
   */
  static async changeDeck(
    id: number,
    side: 'challenger' | 'opponent',
    deckId: number
  ): Promise<Duel | null> {
    const column = side === 'challenger' ? 'challenger_deck_id' : 'opponent_deck_id';
    const readyColumn = side === 'challenger' ? 'challenger_ready' : 'opponent_ready';
    const result = await query(
      `UPDATE duels
          SET ${column} = $1,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
          AND phase_pre_game IS NULL
          AND ${readyColumn} = FALSE
          AND status IN ('pending', 'active')
        RETURNING id`,
      [deckId, id]
    );
    if (result.rows.length === 0) return null;
    return this.findById(id);
  }

  /**
   * Marque un joueur comme « prêt ». Idempotent : un second appel ne change
   * rien. La transition vers `pre_game` (coin flip) est gérée par le controller.
   */
  static async setReady(
    id: number,
    side: 'challenger' | 'opponent'
  ): Promise<Duel | null> {
    const column = side === 'challenger' ? 'challenger_ready' : 'opponent_ready';
    await query(
      `UPDATE duels
          SET ${column} = TRUE,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND phase_pre_game IS NULL
          AND status IN ('pending', 'active')`,
      [id]
    );
    return this.findById(id);
  }

  /**
   * Reset des flags "prêt" — utilisé si on veut retomber dans le lobby après
   * un incident. Non exposé pour l'instant, gardé pour l'admin.
   */
  static async resetReady(id: number): Promise<void> {
    await query(
      `UPDATE duels SET challenger_ready = FALSE, opponent_ready = FALSE
        WHERE id = $1`,
      [id]
    );
  }

  /**
   * Termine le duel avec un gagnant.
   */
  static async finish(id: number, winnerId: number): Promise<Duel | null> {
    await query(
      `UPDATE duels
          SET status = 'finished',
              winner_id = $1,
              finished_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
      [winnerId, id]
    );
    return this.findById(id);
  }
}
