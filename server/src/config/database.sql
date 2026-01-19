-- Database Schema for YuGiOh Collection Manager

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    profile_picture VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cards table (cache from API)
CREATE TABLE IF NOT EXISTS cards (
    id SERIAL PRIMARY KEY,
    card_id VARCHAR(50) UNIQUE NOT NULL, -- YGOProDeck ID
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- Normal Monster, Effect Monster, Fusion Monster, etc.
    frame_type VARCHAR(50), -- normal, effect, fusion, synchro, xyz, link, spell, trap
    description TEXT,
    atk INTEGER,
    def INTEGER,
    level INTEGER,
    race VARCHAR(100), -- Dragon, Warrior, Spellcaster, etc.
    attribute VARCHAR(50), -- DARK, LIGHT, WATER, etc.
    archetype VARCHAR(100),
    card_sets JSONB, -- Array of sets with rarities
    card_images JSONB, -- Array of image URLs
    card_prices JSONB,
    banlist_info JSONB, -- Forbidden, Limited, Semi-Limited status per format
    linkval INTEGER, -- For Link monsters
    linkmarkers JSONB, -- For Link monsters
    scale INTEGER, -- For Pendulum monsters
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cards_name ON cards(name);
CREATE INDEX idx_cards_type ON cards(type);
CREATE INDEX idx_cards_frame_type ON cards(frame_type);

-- User Collections (cards owned by users)
CREATE TABLE IF NOT EXISTS user_cards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    set_code VARCHAR(50), -- e.g., "LDK2-FRK01"
    rarity VARCHAR(50), -- Common, Rare, Super Rare, Ultra Rare, etc.
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, card_id, set_code, rarity)
);

CREATE INDEX idx_user_cards_user_id ON user_cards(user_id);
CREATE INDEX idx_user_cards_card_id ON user_cards(card_id);

-- Decks
CREATE TABLE IF NOT EXISTS decks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    cover_image VARCHAR(255),
    is_public BOOLEAN DEFAULT TRUE,
    respect_banlist BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_decks_user_id ON decks(user_id);
CREATE INDEX idx_decks_public ON decks(is_public);
CREATE INDEX idx_decks_banlist ON decks(respect_banlist);

-- Deck Cards (Main Deck + Extra Deck)
CREATE TABLE IF NOT EXISTS deck_cards (
    id SERIAL PRIMARY KEY,
    deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    is_extra_deck BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deck_cards_deck_id ON deck_cards(deck_id);
CREATE INDEX idx_deck_cards_card_id ON deck_cards(card_id);

-- Follows (Social Network)
CREATE TABLE IF NOT EXISTS follows (
    id SERIAL PRIMARY KEY,
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

-- Deck Wishlists (copied decks)
CREATE TABLE IF NOT EXISTS deck_wishlists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, original_deck_id)
);

CREATE INDEX idx_deck_wishlists_user_id ON deck_wishlists(user_id);

-- Deck Likes/Dislikes
CREATE TABLE IF NOT EXISTS deck_reactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    is_like BOOLEAN NOT NULL, -- true = like, false = dislike
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, deck_id)
);

CREATE INDEX idx_deck_reactions_deck_id ON deck_reactions(deck_id);
CREATE INDEX idx_deck_reactions_user_id ON deck_reactions(user_id);

-- Comments on Decks (with threads)
CREATE TABLE IF NOT EXISTS deck_comments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    parent_comment_id INTEGER REFERENCES deck_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deck_comments_deck_id ON deck_comments(deck_id);
CREATE INDEX idx_deck_comments_user_id ON deck_comments(user_id);
CREATE INDEX idx_deck_comments_parent ON deck_comments(parent_comment_id);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'follow', 'like', 'dislike', 'comment', 'reply'
    from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE,
    comment_id INTEGER REFERENCES deck_comments(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
