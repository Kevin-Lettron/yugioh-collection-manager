import api from '@/services/api';
import type { Deck, DeckUser, PaginatedResponse } from '@/types';

/**
 * Types renvoyés par les endpoints /social/* et /auth/users/*.
 * Miroir minimal côté mobile — on ne mappe que ce qui est réellement consommé
 * par les écrans Social et Profile.
 */

export interface FollowUser extends DeckUser {
  followed_at?: string;
  // Le back joint parfois d'autres colonnes (bio, decks_count) : on garde permissif.
  bio?: string;
  decks_count?: number;
}

export interface UserSearchResult {
  id: number;
  username: string;
  profile_picture?: string;
  bio?: string;
  is_following?: boolean;
}

export interface PublicUserProfile {
  user: {
    id: number;
    username: string;
    profile_picture?: string;
    bio?: string;
    created_at?: string;
    role?: string;
  };
  followerCount: number;
  followingCount: number;
}

/**
 * Wishlist item côté API — le back renvoie chaque entrée avec le deck complet
 * imbriqué (deck) plus la date d'ajout.
 */
export interface WishlistItem {
  id: number;
  deck_id: number;
  created_at: string;
  deck: Deck;
}

export const socialApi = {
  // ── Feed decks publics — on réutilise l'endpoint /decks/public existant.
  //    Le tri (popular / recent / following) se fait côté client faute d'endpoint
  //    dédié. Le filtre by user_id est supporté par le back (deckController#getPublicDecks).
  feed: (params: { page?: number; limit?: number; search?: string; user_id?: number } = {}) =>
    api
      .get<{ data: Deck[]; total: number; page: number; total_pages: number }>(
        '/decks/public',
        { params }
      )
      .then((r) => r.data),

  // ── Users
  searchUsers: (q?: string) =>
    api
      .get<UserSearchResult[]>('/auth/users/search', {
        params: q ? { q } : undefined,
      })
      .then((r) => r.data),

  getUser: (id: number) =>
    api.get<PublicUserProfile>(`/auth/users/${id}`).then((r) => r.data),

  // ── Follow
  follow: (userId: number) =>
    api.post<{ message: string }>(`/social/follow/${userId}`).then((r) => r.data),

  unfollow: (userId: number) =>
    api.delete<{ message: string }>(`/social/follow/${userId}`).then((r) => r.data),

  getFollowing: (userId?: number) =>
    api
      .get<{ following: FollowUser[] } & PaginatedResponse<FollowUser>>(
        userId ? `/social/following/${userId}` : '/social/following'
      )
      .then((r) => r.data.following ?? []),

  getFollowers: (userId?: number) =>
    api
      .get<{ followers: FollowUser[] } & PaginatedResponse<FollowUser>>(
        userId ? `/social/followers/${userId}` : '/social/followers'
      )
      .then((r) => r.data.followers ?? []),

  // ── Wishlist (= « copier deck » côté produit)
  wishlist: (deckId: number) =>
    api.post<{ message: string }>(`/social/wishlist/${deckId}`).then((r) => r.data),

  unwishlist: (deckId: number) =>
    api.delete<{ message: string }>(`/social/wishlist/${deckId}`).then((r) => r.data),

  getWishlist: () =>
    api
      .get<{ wishlist: WishlistItem[] } | WishlistItem[]>('/social/wishlist')
      .then((r) => {
        // Le back a évolué : on tolère les deux formes (tableau nu ou wrapper).
        const raw = r.data as unknown;
        if (Array.isArray(raw)) return raw as WishlistItem[];
        return (raw as { wishlist: WishlistItem[] }).wishlist ?? [];
      }),
};

export default socialApi;
