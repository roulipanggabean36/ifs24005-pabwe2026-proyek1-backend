PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  brand         TEXT    NOT NULL,
  category      TEXT    NOT NULL
                CHECK (category IN ('cleanser','toner','serum','moisturizer','sunscreen','mask','other')),
  opened_date   TEXT,
  expiry_date   TEXT    NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  price         INTEGER,
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS routines (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id     INTEGER NOT NULL,
  used_at        TEXT    NOT NULL,
  time_of_day    TEXT    NOT NULL
                 CHECK (time_of_day IN ('morning','night')),
  skin_condition TEXT    NOT NULL
                 CHECK (skin_condition IN ('great','good','normal','dry','oily','breakout','irritated')),
  skin_rating    INTEGER CHECK (skin_rating BETWEEN 1 AND 5),
  notes          TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_routines_product ON routines(product_id);
CREATE INDEX IF NOT EXISTS idx_routines_used_at ON routines(used_at);
CREATE INDEX IF NOT EXISTS idx_products_expiry  ON products(expiry_date);
