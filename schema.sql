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

-- ---------------------------------------------------------------------------
-- LECTORES DE VERDAD
-- Cada fila es una visita confirmada por el navegador (ver src/lib/lectores.ts).
-- NO se guarda la direccion IP ni nada que identifique a una persona: `visitante` es una huella
-- anonima que cambia cada dia, asi que sirve para contar sin poder seguir a nadie.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visitas (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  dia TEXT NOT NULL,
  pais TEXT,
  ruta TEXT NOT NULL,
  lang TEXT,
  visitante TEXT NOT NULL,
  referente TEXT
);
CREATE INDEX IF NOT EXISTS idx_visitas_dia ON visitas(dia);
CREATE INDEX IF NOT EXISTS idx_visitas_ts ON visitas(ts DESC);
CREATE INDEX IF NOT EXISTS idx_visitas_pais ON visitas(dia, pais);
CREATE INDEX IF NOT EXISTS idx_visitas_ruta ON visitas(dia, ruta);

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


-- Pedidos de la página pública «Publica tu noticia» (comunicados autoservicio).
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  website TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  plan TEXT NOT NULL DEFAULT 'basica',
  notes_total INTEGER NOT NULL DEFAULT 1,
  price_usd REAL NOT NULL DEFAULT 0,
  section_id TEXT,
  lang TEXT NOT NULL DEFAULT 'es',
  brief TEXT,
  ideas TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  sponsor_id TEXT,
  internal_notes TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at DESC);


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


-- Especialidades de cada autor (secciones que domina). Columna añadida el 23 ago 2026: en las bases
-- que ya existían se agrega con ALTER (el guardián tolera que ya esté puesta).
ALTER TABLE authors ADD COLUMN sections_json TEXT NOT NULL DEFAULT '[]';
-- Motivo por el que no salio el correo de confirmacion. Se manda en segundo plano para que la
-- persona no espere, y sin esta columna un fallo del servicio de correo no dejaria ni rastro.
ALTER TABLE subscribers ADD COLUMN mail_error TEXT;
-- Cuantas veces se ha intentado escribir sobre este tema. Sin este contador, un tema que hace
-- fallar la corrida se vuelve a elegir siempre y paraliza el diario (24 ago 2026).
ALTER TABLE candidates ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
-- Credenciales publicas de cada firma. Google Noticias cruza estos perfiles para comprobar que
-- detras de una nota hay una persona real y con experiencia (E-E-A-T). Van al JSON-LD como sameAs.
ALTER TABLE authors ADD COLUMN linkedin_url TEXT;
ALTER TABLE authors ADD COLUMN x_url TEXT;
ALTER TABLE authors ADD COLUMN public_email TEXT;
ALTER TABLE authors ADD COLUMN expertise_es TEXT;
ALTER TABLE authors ADD COLUMN expertise_en TEXT;
-- Pie de foto: lo que se lee DEBAJO de la imagen. Es distinto del texto alternativo (ese describe
-- la imagen para quien no la ve); el pie cuenta algo y es de lo mas leido de una pagina.
ALTER TABLE articles ADD COLUMN image_caption_es TEXT;
ALTER TABLE articles ADD COLUMN image_caption_en TEXT;
-- Cuando se le mando el recordatorio de confirmar. Sin esta marca se le mandaria uno cada dia, que
-- es la forma mas rapida de acabar en la carpeta de spam.
ALTER TABLE subscribers ADD COLUMN reminded_at TEXT;
-- Patrocinio de seccion (idea 3 del plan de ingresos): una marca patrocina una seccion entera y
-- aparece en su portada. Es distinto de una nota patrocinada: aqui no se escribe nada, se acompaña.
ALTER TABLE sponsors ADD COLUMN section_sponsored TEXT;
ALTER TABLE sponsors ADD COLUMN section_until TEXT;
ALTER TABLE sponsors ADD COLUMN logo_url TEXT;
ALTER TABLE sponsors ADD COLUMN claim_es TEXT;
ALTER TABLE sponsors ADD COLUMN claim_en TEXT;
-- Cuanto tiempo lleva leyendo esa persona esa nota, en segundos, y de donde llego.
ALTER TABLE visitas ADD COLUMN segundos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE visitas ADD COLUMN origen TEXT;



-- Equipo de redacción (personas reales). El robot reparte las notas entre ellos por turnos.
INSERT OR IGNORE INTO authors (id, name, kind, sections_json, bio_es, bio_en, role_es, role_en, avatar_url) VALUES
  ('andreea-blidar', 'Andreea Blidar', 'person', '["economia","tecnologia"]',
   'Escribe sobre economía, dinero del día a día y tecnología en losupe. Le interesa explicar en claro lo que mueve los precios, las tasas y el trabajo, y qué significa cada novedad tecnológica para una persona normal. Revisa cada dato con la fuente original antes de publicarlo.',
   'Writes about the economy, everyday money, and technology at losupe. She likes explaining in plain language what moves prices, rates, and jobs, and what each tech development means for an ordinary person. She checks every figure against the original source before publishing.',
   'Economía y tecnología', 'Economy and technology', '/img/autores/andreea-blidar.jpg'),
  ('merry-melina', 'Merry Melina', 'person', '["artistas","ventas"]',
   'Cubre música, artistas y tendencias, y también historias de negocios y emprendimiento en losupe. Busca el lado humano de cada tema: quién está detrás, qué cambió para la gente y por qué importa hoy.',
   'Covers music, artists, and trends, plus business and entrepreneurship stories at losupe. She looks for the human side of every topic: who is behind it, what changed for people, and why it matters today.',
   'Artistas, tendencias y negocios', 'Artists, trends, and business', '/img/autores/merry-melina.jpg'),
  ('pedro-llerena', 'Pedro Llerena', 'person', '["cripto","ventas"]',
   'Escribe sobre criptomonedas, tecnología aplicada al comercio y emprendimiento en losupe. Empresario con experiencia en comercio electrónico, cuenta lo que pasa en el mercado con los pies en la tierra y sin promesas fáciles.',
   'Writes about cryptocurrencies, commerce technology, and entrepreneurship at losupe. An entrepreneur with e-commerce experience, he covers the market with both feet on the ground and no easy promises.',
   'Cripto y emprendimiento', 'Crypto and entrepreneurship', '/img/autores/pedro-llerena.jpg');

-- Magaly Molina no llegó a incorporarse: queda inactiva y sus notas pasan al equipo actual.
-- OJO: el `INSERT OR IGNORE INTO settings` de arriba NO cambia un ajuste que ya existía, así que la
-- firma por defecto se corrige con un UPDATE explícito (si no, el robot seguía firmando con ella).
UPDATE settings SET value = 'andreea-blidar', updated_at = datetime('now')
  WHERE key = 'default_author' AND value NOT IN (SELECT id FROM authors WHERE active = 1);
UPDATE authors SET active = 0 WHERE id = 'magaly-molina';
-- El prompt del robot la nombraba, así que el modelo llegó a escribir la firma DENTRO del cuerpo.
-- Se limpia de las notas ya publicadas (el limpiador del redactor evita que vuelva a pasar).
UPDATE article_i18n SET content_html = REPLACE(content_html, '<p>Por Magaly Molina</p>', '')
  WHERE content_html LIKE '%Por Magaly Molina%';
UPDATE article_i18n SET content_html = REPLACE(content_html, '<p>By Magaly Molina</p>', '')
  WHERE content_html LIKE '%By Magaly Molina%';
UPDATE authors SET sections_json = '[]' WHERE id IN ('equipo-losupe', 'kevin-rondon');
UPDATE articles SET author_id = 'andreea-blidar' WHERE author_id = 'magaly-molina' AND section_id = 'economia';
UPDATE articles SET author_id = 'merry-melina' WHERE author_id = 'magaly-molina';

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('default_author', 'andreea-blidar'),
  ('robot_paused', '1'),
  ('daily_budget_usd', '1.00'),
  ('notes_per_day', '4'),
  ('languages', 'es,en'),
  ('timezone', 'America/New_York'),
  ('evergreen_ratio', '0.5'),
  ('robot_auto_publish', '0'),
  ('robot_last_kind', 'universal'),
  ('robot_notes_per_run', '1'),
  ('sponsor_min_gap_hours', '72'),
  ('sponsor_max_per_week', '2'),
  -- La mesa de redaccion: cuantas de cada diez notas propias son piezas de curiosidades y listas,
  -- y si se aprovechan las efemerides del dia (los 10 años sin Juan Gabriel, etc).
  ('mesa_ratio_propias', '0.4'),
  ('mesa_efemerides', '1'),
  -- El boletin de resumen: uno cada cuatro dias con lo mejor, en vez de un correo por nota.
  ('boletin_activo', '1'),
  ('boletin_dias', '4');

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
  ('bing-artistas-es', 'artistas', 'Bing Noticias: artistas y música (ES)', 'https://www.bing.com/news/search?q=artistas+m%C3%BAsica+estrenos&format=rss&setlang=es', 'rss', 'es', 2),
  ('google-trends-us-es', 'artistas', 'Google Trends: lo más buscado hoy en EE. UU. (ES)', 'https://trends.google.com/trending/rss?geo=US&hl=es-419', 'trends', 'es', 3),
  ('google-trends-us-en', 'artistas', 'Google Trends: top searches today in the U.S. (EN)', 'https://trends.google.com/trending/rss?geo=US&hl=en-US', 'trends', 'en', 3);

-- Primer patrocinador real: YaDominios (la plataforma donde vive losupe). Sirve de ejemplo vivo
-- del módulo de encargos. Se puede editar o cancelar desde el panel sin tocar este archivo.
INSERT OR IGNORE INTO sponsors (id, name, website, contact_name, contact_email, brief, section_id, notes_total, status, internal_notes) VALUES
  ('sp-yadominios', 'YaDominios', 'https://yadominios.com/', 'Equipo YaDominios', 'hola@yadominios.com',
   'Plataforma de dominios y hosting en la nube fundada en 2006, con soporte en español. Eslogan: Tu dominio, listo ya. Registra dominios (.com desde 14 dólares al año, privacidad WHOIS incluida, sin aumentos ocultos en la renovación) y ofrece YaDominios Cloud, hosting con cuatro planes (Nébula 3, Órbita 6, Galaxia 15 y Cosmos 39 dólares al mes) con SSL, DNS, CDN global en más de 330 ciudades, base de datos D1 y archivos R2, correo desde tu dominio y publicación automática desde GitHub. Suma herramientas de IA: Blisor AI para crear páginas web, un ERP con IA para inventario, ventas y clientes, y una Pasarela de Agentes para darle un asistente de IA a cualquier sistema. Público: emprendedores, pequeños negocios, desarrolladores y agencias que quieren todo integrado y sin complicaciones. Tono: cercano, claro, sin jerga, orgulloso de ser en español.',
   'tecnologia', 4, 'active',
   'Patrocinador de arranque. Es la plataforma donde se publica losupe.');

INSERT OR IGNORE INTO assignments (id, sponsor_id, position, title_idea, brief, section_id, status) VALUES
  ('as-yad-1', 'sp-yadominios', 1,
   'Cómo publicar tu página web en la nube sin saber de servidores',
   'Guía duradera: explicar paso a paso qué es YaDominios Cloud, cómo se conecta un repositorio de GitHub y qué incluye cada plan. Enfoque en el emprendedor que no es técnico.',
   'tecnologia', 'queued'),
  ('as-yad-2', 'sp-yadominios', 2,
   'Cuánto cuesta de verdad tener un dominio y una página en 2026',
   'Comparar precios reales y explicar el problema de las renovaciones que suben de golpe. Citar los precios publicados por la empresa.',
   'economia', 'queued'),
  ('as-yad-3', 'sp-yadominios', 3,
   'Crear una página web con inteligencia artificial: qué se puede y qué no',
   'Sobre Blisor AI. Qué resuelve, para quién sirve, qué esperar de una página hecha con IA y qué sigue haciendo falta.',
   'tecnologia', 'queued'),
  ('as-yad-4', 'sp-yadominios', 4,
   'Un asistente de IA dentro de tu negocio: para qué sirve la Pasarela de Agentes',
   'Sobre el ERP con IA y la Pasarela de Agentes, con ejemplos de tareas reales de una tienda o una agencia.',
   'ventas', 'queued');

-- Reparación de fechas (24 ago 2026). Durante un tiempo parte del código escribió las horas con
-- `datetime('now')`, que guarda "2026-08-24 05:12:00" (con espacio), mientras el resto guardaba
-- "2026-08-24T05:12:00.000Z". SQLite las compara como TEXTO y el espacio vale menos que la T, así que
-- una nota de hace 4 horas parecía más vieja que el corte: el freno de los patrocinadores no saltaba.
-- Esto pasa todas las filas viejas al formato único. Es idempotente: al quedar con T ya no coinciden.
UPDATE assignments SET published_at = replace(published_at, ' ', 'T') || 'Z'
  WHERE published_at IS NOT NULL AND substr(published_at, 11, 1) = ' ';
UPDATE assignments SET created_at = replace(created_at, ' ', 'T') || 'Z'
  WHERE substr(created_at, 11, 1) = ' ';
UPDATE assignments SET updated_at = replace(updated_at, ' ', 'T') || 'Z'
  WHERE substr(updated_at, 11, 1) = ' ';
UPDATE sponsors SET created_at = replace(created_at, ' ', 'T') || 'Z'
  WHERE substr(created_at, 11, 1) = ' ';
UPDATE sponsors SET updated_at = replace(updated_at, ' ', 'T') || 'Z'
  WHERE substr(updated_at, 11, 1) = ' ';
UPDATE orders SET updated_at = replace(updated_at, ' ', 'T') || 'Z'
  WHERE substr(updated_at, 11, 1) = ' ';
UPDATE orders SET created_at = replace(created_at, ' ', 'T') || 'Z'
  WHERE substr(created_at, 11, 1) = ' ';
UPDATE settings SET updated_at = replace(updated_at, ' ', 'T') || 'Z'
  WHERE substr(updated_at, 11, 1) = ' ';
UPDATE runs SET finished_at = replace(finished_at, ' ', 'T') || 'Z'
  WHERE finished_at IS NOT NULL AND substr(finished_at, 11, 1) = ' ';
UPDATE subscribers SET confirmed_at = replace(confirmed_at, ' ', 'T') || 'Z'
  WHERE confirmed_at IS NOT NULL AND substr(confirmed_at, 11, 1) = ' ';
UPDATE subscribers SET unsubscribed_at = replace(unsubscribed_at, ' ', 'T') || 'Z'
  WHERE unsubscribed_at IS NOT NULL AND substr(unsubscribed_at, 11, 1) = ' ';
UPDATE subscribers SET last_sent_at = replace(last_sent_at, ' ', 'T') || 'Z'
  WHERE last_sent_at IS NOT NULL AND substr(last_sent_at, 11, 1) = ' ';
UPDATE articles SET created_at = replace(created_at, ' ', 'T') || 'Z'
  WHERE substr(created_at, 11, 1) = ' ';
UPDATE articles SET updated_at = replace(updated_at, ' ', 'T') || 'Z'
  WHERE substr(updated_at, 11, 1) = ' ';
UPDATE run_items SET created_at = replace(created_at, ' ', 'T') || 'Z'
  WHERE substr(created_at, 11, 1) = ' ';
UPDATE run_items SET updated_at = replace(updated_at, ' ', 'T') || 'Z'
  WHERE substr(updated_at, 11, 1) = ' ';

-- Especialidad de cada firma, en palabras que Google entiende como areas de conocimiento. Se
-- escribe aqui y no en el codigo para que se pueda ajustar sin publicar. Los perfiles de LinkedIn
-- y X los rellena Richard cuando los tenga: son suyos, no se inventan.
UPDATE authors SET expertise_es = 'Economía de Estados Unidos, inflación, empleo, tecnología e inteligencia artificial',
                   expertise_en = 'US economy, inflation, jobs, technology and artificial intelligence'
 WHERE id = 'andreea-blidar';
UPDATE authors SET expertise_es = 'Cultura, tendencias, redes sociales, ventas y marketing digital',
                   expertise_en = 'Culture, trends, social media, sales and digital marketing'
 WHERE id = 'merry-melina';
UPDATE authors SET expertise_es = 'Criptomonedas, blockchain, emprendimiento y pequeños negocios',
                   expertise_en = 'Cryptocurrency, blockchain, entrepreneurship and small business'
 WHERE id = 'pedro-llerena';

-- La escaleta pide CUATRO notas al dia (2 de actualidad + 2 de curiosidades). El ajuste ya existia
-- con el valor viejo y el INSERT OR IGNORE de arriba no lo pisa, asi que se sube aqui. Solo se toca
-- si sigue en el valor anterior: si Richard lo cambia a mano en el panel, se respeta.
UPDATE settings SET value = '4', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE key = 'notes_per_day' AND value IN ('3', '6');

-- Indice para encontrar deprisa la lectura de una persona en una pagina y un dia. NO es unico a
-- proposito: crear un indice unico sobre datos que ya existen falla si hay repetidos, y con el se
-- cae TODO el resto del esquema (paso el 28 ago 2026). La unicidad se resuelve en el codigo, con un
-- UPDATE y, solo si no habia nada que actualizar, un INSERT. Ver anotarVisita() en lectores.ts.
CREATE INDEX IF NOT EXISTS idx_visitas_lectura ON visitas(dia, visitante, ruta);
