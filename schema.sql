-- losupe.com — esquema de la base de datos (D1 / SQLite).
-- Idempotente: YaDominios Cloud lo ejecuta en cada publicación.
-- Regla: nada de punto y coma dentro de los textos de este archivo.

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes_per_day INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS authors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'person',
  bio_es TEXT,
  bio_en TEXT,
  role_es TEXT,
  role_en TEXT,
  avatar_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES sections(id),
  author_id TEXT NOT NULL REFERENCES authors(id),
  status TEXT NOT NULL DEFAULT 'draft',
  kind TEXT NOT NULL DEFAULT 'evergreen',
  origin TEXT NOT NULL DEFAULT 'manual',
  image_url TEXT,
  image_alt_es TEXT,
  image_alt_en TEXT,
  image_credit TEXT,
  sources_json TEXT NOT NULL DEFAULT '[]',
  ai_assisted INTEGER NOT NULL DEFAULT 0,
  reading_minutes INTEGER,
  views INTEGER NOT NULL DEFAULT 0,
  legacy_id TEXT,
  legacy_slug TEXT,
  is_premium INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_articles_pub ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_section ON articles(section_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id, status, published_at DESC);

CREATE TABLE IF NOT EXISTS article_i18n (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  content_html TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  machine_translated INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, lang)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_i18n_slug ON article_i18n(lang, slug);

-- Índice de texto completo del buscador (tolerante a acentos, prefijos, ranking bm25).
-- Se llena desde el código (rebuildSearchIndex / indexArticle), sin triggers.
CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
  article_id UNINDEXED,
  lang UNINDEXED,
  title,
  excerpt,
  tags,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- Fuentes que lee el robot (RSS, búsqueda). Se administran desde el panel.
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES sections(id),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'rss',
  lang TEXT NOT NULL DEFAULT 'es',
  weight INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  last_ok_at TEXT,
  last_error TEXT
);

-- Corridas del robot (una por mañana) y sus piezas.
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL,
  step TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  summary_json TEXT,
  error TEXT
);
CREATE TABLE IF NOT EXISTS run_items (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  section_id TEXT,
  status TEXT NOT NULL,
  step TEXT,
  topic TEXT,
  sources_json TEXT,
  article_id TEXT,
  cost_usd REAL NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Registro de gasto en IA e imágenes, por día. El tope diario vive en settings.
CREATE TABLE IF NOT EXISTS spend_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  units REAL NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  run_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_spend_day ON spend_log(day);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Suscriptores del boletín (fase 4).
CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  lang TEXT NOT NULL DEFAULT 'es',
  status TEXT NOT NULL DEFAULT 'pending',
  sections_json TEXT NOT NULL DEFAULT '[]',
  token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT,
  unsubscribed_at TEXT,
  last_sent_at TEXT
);

CREATE TABLE IF NOT EXISTS page_views (
  day TEXT NOT NULL,
  article_id TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, article_id)
);


-- Patrocinadores: empresas que compraron notas (encargos) en losupe. Se administran desde el panel.
CREATE TABLE IF NOT EXISTS sponsors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  brief TEXT,
  section_id TEXT REFERENCES sections(id),
  notes_total INTEGER NOT NULL DEFAULT 1,
  period_start TEXT,
  period_end TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  internal_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cola de encargos: cada fila es una nota prometida a un patrocinador (idea de titular + brief + fuentes).
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  title_idea TEXT NOT NULL,
  brief TEXT,
  section_id TEXT REFERENCES sections(id),
  source_urls_json TEXT NOT NULL DEFAULT '[]',
  scheduled_for TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  research_json TEXT,
  article_id TEXT,
  run_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_assignments_queue ON assignments(status, scheduled_for, position);
CREATE INDEX IF NOT EXISTS idx_assignments_sponsor ON assignments(sponsor_id, status);

-- Candidatos de noticias universales que el robot descubre en las fuentes (RSS o búsqueda).
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  section_id TEXT NOT NULL REFERENCES sections(id),
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  lang TEXT NOT NULL DEFAULT 'es',
  published_at TEXT,
  score REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  article_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_candidates_pick ON candidates(status, section_id, score DESC, published_at DESC);

-- Sesiones del panel (se borran al cerrar sesión) e intentos de entrada (límite por IP).
CREATE TABLE IF NOT EXISTS panel_sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT
);
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  ok INTEGER NOT NULL DEFAULT 0,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip, at);

-- Datos base (idempotentes).
INSERT OR IGNORE INTO sections (id, sort_order, notes_per_day) VALUES
  ('economia', 1, 2),
  ('ventas', 2, 1),
  ('tecnologia', 3, 1),
  ('cripto', 4, 1),
  ('artistas', 5, 1);

INSERT OR IGNORE INTO authors (id, name, kind, bio_es, bio_en, role_es, role_en) VALUES
  ('equipo-losupe', 'Equipo editorial de losupe', 'newsroom',
   'Redacción de losupe. Leemos varias fuentes, escribimos en claro y citamos de dónde sale cada dato. Parte del trabajo se hace con ayuda de inteligencia artificial y lo revisa el equipo.',
   'The losupe newsroom. We read multiple sources, write in plain language, and cite where every fact comes from. Part of the work is done with help from AI and reviewed by the team.',
   'Redacción', 'Newsroom'),
  ('kevin-rondon', 'Kevin Rondón', 'person',
   'Periodista especializado en criptomonedas y mercados. Escribió para MundosCrypto, el portal que dio origen a losupe.',
   'Journalist covering cryptocurrencies and markets. He wrote for MundosCrypto, the portal that became losupe.',
   'Periodista de cripto y mercados', 'Crypto and markets journalist'),
  ('magaly-molina', 'Magaly Molina', 'person',
   'Editora de losupe. Firma y revisa las notas de economía, ventas, tecnología e inteligencia artificial, cripto y tendencias que publicamos cada mañana.',
   'Editor at losupe. She writes and reviews the economy, sales, technology and AI, crypto, and trends stories we publish every morning.',
   'Editora', 'Editor');

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('default_author', 'magaly-molina'),
  ('robot_paused', '1'),
  ('daily_budget_usd', '1.00'),
  ('notes_per_day', '6'),
  ('languages', 'es,en'),
  ('timezone', 'America/New_York'),
  ('evergreen_ratio', '0.7'),
  ('robot_auto_publish', '0'),
  ('robot_last_kind', 'universal'),
  ('robot_notes_per_run', '1');

-- Fuentes iniciales del robot (RSS públicos). Se pueden apagar o ampliar desde el panel.
INSERT OR IGNORE INTO sources (id, section_id, name, url, kind, lang, weight) VALUES
  ('bing-economia-es', 'economia', 'Bing Noticias: economía (ES)', 'https://www.bing.com/news/search?q=econom%C3%ADa+Estados+Unidos&format=rss&setlang=es', 'rss', 'es', 2),
  ('bing-economy-en', 'economia', 'Bing News: economy (EN)', 'https://www.bing.com/news/search?q=economy&format=rss&setlang=en', 'rss', 'en', 1),
  ('entrepreneur-en', 'ventas', 'Entrepreneur', 'https://www.entrepreneur.com/latest.rss', 'rss', 'en', 1),
  ('bing-emprendimiento-es', 'ventas', 'Bing Noticias: emprendimiento y ventas (ES)', 'https://www.bing.com/news/search?q=emprendimiento+ventas+pymes&format=rss&setlang=es', 'rss', 'es', 2),
  ('theverge-ai', 'tecnologia', 'The Verge', 'https://www.theverge.com/rss/index.xml', 'rss', 'en', 1),
  ('google-ai-blog', 'tecnologia', 'Google AI blog', 'https://blog.google/technology/ai/rss/', 'rss', 'en', 2),
  ('bing-ia-es', 'tecnologia', 'Bing Noticias: inteligencia artificial (ES)', 'https://www.bing.com/news/search?q=inteligencia+artificial&format=rss&setlang=es', 'rss', 'es', 2),
  ('coindesk', 'cripto', 'CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/', 'rss', 'en', 2),
  ('cointelegraph-es', 'cripto', 'Cointelegraph en español', 'https://es.cointelegraph.com/rss', 'rss', 'es', 2),
  ('billboard', 'artistas', 'Billboard', 'https://www.billboard.com/feed/', 'rss', 'en', 1),
  ('bing-artistas-es', 'artistas', 'Bing Noticias: artistas y música (ES)', 'https://www.bing.com/news/search?q=artistas+m%C3%BAsica+estrenos&format=rss&setlang=es', 'rss', 'es', 2);
