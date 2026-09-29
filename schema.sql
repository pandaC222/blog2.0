-- blog2.0 SQLite schema
-- Matches src/content.config.ts posts collection (Mizuki / Astro).
-- Dates are ISO-8601 TEXT with explicit offset (site timezone UTC+8).
-- Do not store naive datetimes: "2026-07-17T19:42:00" would be misread as UTC.

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ---------------------------------------------------------------------------
-- posts
-- One row = one Markdown article.
-- slug comes from the filename (Astro entry.id without extension),
-- e.g. "Codeforces Round 1090 (Div. 4).md" -> slug of the same name.
-- prev/next in content.config.ts are computed at read time, not stored.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,

    -- identity / routing
    slug          TEXT NOT NULL UNIQUE,          -- filename without .md
    source_path   TEXT NOT NULL DEFAULT '',      -- original relative path, for migration audit
    alias         TEXT,                          -- optional extra route (content.config alias)
    permalink     TEXT,                          -- custom permalink, higher priority than alias

    -- frontmatter (1:1 with content.config.ts)
    title         TEXT NOT NULL,
    published_at  TEXT NOT NULL,                 -- siteDate, e.g. 2026-04-05T00:00:00+08:00
    updated_at    TEXT,                          -- optional siteDate
    draft         INTEGER NOT NULL DEFAULT 0,    -- 0/1, default false
    description   TEXT NOT NULL DEFAULT '',
    image         TEXT NOT NULL DEFAULT '',      -- cover path, frontmatter key is "image" not "cover"
    category      TEXT NOT NULL DEFAULT '',      -- singular string; schema is NOT an array
    lang          TEXT NOT NULL DEFAULT '',
    pinned        INTEGER NOT NULL DEFAULT 0,    -- 0/1
    comment       INTEGER NOT NULL DEFAULT 1,    -- 0/1, per-post comment switch, default true
    priority      INTEGER,                       -- optional sort weight among pinned posts
    author        TEXT NOT NULL DEFAULT '',
    source_link   TEXT NOT NULL DEFAULT '',      -- frontmatter sourceLink
    license_name  TEXT NOT NULL DEFAULT '',      -- frontmatter licenseName
    license_url   TEXT NOT NULL DEFAULT '',      -- frontmatter licenseUrl

    -- page encryption (defined in schema, unused by current posts)
    encrypted     INTEGER NOT NULL DEFAULT 0,
    password      TEXT NOT NULL DEFAULT '',
    password_hint TEXT NOT NULL DEFAULT '',      -- frontmatter passwordHint

    -- body
    body          TEXT NOT NULL DEFAULT '',      -- raw Markdown, frontmatter stripped

    -- dynamic (not in frontmatter)
    views         INTEGER NOT NULL DEFAULT 0,

    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S+08:00', 'now', '+8 hours')),
    db_updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S+08:00', 'now', '+8 hours'))
);

CREATE INDEX IF NOT EXISTS idx_posts_published ON posts (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_draft ON posts (draft, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_pinned ON posts (pinned DESC, priority ASC, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts (category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_permalink ON posts (permalink) WHERE permalink IS NOT NULL AND permalink <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_alias ON posts (alias) WHERE alias IS NOT NULL AND alias <> '';

-- ---------------------------------------------------------------------------
-- post_tags
-- frontmatter tags: string[]. One row per tag. Order preserved.
-- Category is NOT here; it stays on posts.category.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_tags (
    post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag        TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (post_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags (tag);

-- ---------------------------------------------------------------------------
-- comments
-- New dynamic comments. Existing Twikoo/Giscus widgets stay untouched on the
-- page; this table backs the local comment API added later.
-- Store plain text only. Escape on output. Never render body as HTML.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    parent_id  INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    author     TEXT NOT NULL,
    email      TEXT NOT NULL DEFAULT '',         -- not shown on the public page
    content    TEXT NOT NULL,                    -- plain text
    status     TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'pending')),
    is_admin   INTEGER NOT NULL DEFAULT 0,       -- 1 = reply posted from /admin
    ip_hash    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S+08:00', 'now', '+8 hours'))
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id, created_at);

-- ---------------------------------------------------------------------------
-- admin_users
-- Single-admin login for /admin. Password is a hash, never plaintext.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S+08:00', 'now', '+8 hours'))
);

-- ---------------------------------------------------------------------------
-- uploads
-- Local image files served from /uploads. posts.image and Markdown image
-- links store the public path (e.g. /uploads/1784243302458-cover.jpg).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uploads (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    filename      TEXT NOT NULL,                 -- stored filename
    original_name TEXT NOT NULL DEFAULT '',
    mime          TEXT NOT NULL DEFAULT '',
    size_bytes    INTEGER NOT NULL DEFAULT 0,
    public_path   TEXT NOT NULL UNIQUE,          -- URL path, starts with /uploads/
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S+08:00', 'now', '+8 hours'))
);
