-- Migration: actualites Yu-Gi-Oh — flux RSS agreges et abonnements par theme.
--
-- Trois tables :
--   news_sources        les flux, leur sante et leur cadence
--   news_items          les articles, dedupliques par (source, guid)
--   user_news_topics    ce que chaque utilisateur suit
--
-- On ne stocke jamais le corps d'un article : titre, resume fourni par le flux,
-- lien, date, illustration. Le clic renvoie toujours au site d'origine.

CREATE TABLE IF NOT EXISTS news_sources (
  id                    SERIAL PRIMARY KEY,
  -- Cle stable utilisee dans le code ; l'id peut changer d'une base a l'autre.
  key                   VARCHAR(40) UNIQUE NOT NULL,
  name                  VARCHAR(120) NOT NULL,
  feed_url              TEXT NOT NULL,
  homepage              TEXT,
  -- Themes appliques par defaut aux articles de cette source quand la
  -- classification ne trouve rien de mieux. Vide = l'article est ecarte.
  default_topics        TEXT[] NOT NULL DEFAULT '{}',
  -- Une source multi-jeux (Pojo) exige qu'un theme soit reconnu, sinon on
  -- ecarte : sans ca le fil se remplit de Pokemon et de Magic.
  requires_topic_match  BOOLEAN NOT NULL DEFAULT FALSE,
  enabled               BOOLEAN NOT NULL DEFAULT TRUE,
  -- Cadence minimale entre deux appels. Reddit repond 429 des le deuxieme
  -- appel rapproche : chaque source porte la sienne.
  min_interval_minutes  INTEGER NOT NULL DEFAULT 30,
  last_fetch_at         TIMESTAMPTZ,
  last_success_at       TIMESTAMPTZ,
  last_error            TEXT,
  last_error_at         TIMESTAMPTZ,
  -- Trois echecs d'affilee mettent la source en sommeil au lieu de la marteler.
  consecutive_failures  INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news_items (
  id            SERIAL PRIMARY KEY,
  source_id     INTEGER NOT NULL REFERENCES news_sources(id) ON DELETE CASCADE,
  -- Identifiant fourni par le flux, ou l'URL a defaut. C'est la cle de
  -- deduplication : un flux republie les memes articles a chaque appel.
  guid          TEXT NOT NULL,
  url           TEXT NOT NULL,
  title         TEXT NOT NULL,
  summary       TEXT,
  image_url     TEXT,
  published_at  TIMESTAMPTZ NOT NULL,
  topics        TEXT[] NOT NULL DEFAULT '{}',
  lang          VARCHAR(5) NOT NULL DEFAULT 'en',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT news_items_guid_unique UNIQUE (source_id, guid)
);

CREATE INDEX IF NOT EXISTS idx_news_items_published ON news_items (published_at DESC);
-- GIN : le fil filtre et pondere par themes, c'est la requete du chemin chaud.
CREATE INDEX IF NOT EXISTS idx_news_items_topics ON news_items USING GIN (topics);

CREATE TABLE IF NOT EXISTS user_news_topics (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic       VARCHAR(20) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_user_news_topics_user ON user_news_topics (user_id);

-- Sources de depart. Chacune a ete appelee et verifiee avant d'etre inscrite
-- ici — cf. docs/PLAN-ACTUALITES.md pour le releve.
INSERT INTO news_sources (key, name, feed_url, homepage, default_topics, requires_topic_match, min_interval_minutes)
VALUES
  ('ygorganization', 'YGOrganization', 'https://ygorganization.com/feed/', 'https://ygorganization.com/',
   ARRAY['tcg'], FALSE, 30),
  ('pojo', 'Pojo', 'https://www.pojo.com/feed/', 'https://www.pojo.com/',
   ARRAY[]::TEXT[], TRUE, 60),
  ('reddit_yugioh', 'Reddit r/yugioh', 'https://www.reddit.com/r/yugioh/.rss', 'https://www.reddit.com/r/yugioh/',
   ARRAY[]::TEXT[], TRUE, 120)
ON CONFLICT (key) DO NOTHING;
