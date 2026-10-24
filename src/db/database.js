import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { hashPassword } from '../utils/password.js';

const require = createRequire(import.meta.url);

// SQLite bawaan runtime: bun:sqlite di Bun, node:sqlite di Node.js (>= 22.13).
// Tidak ada modul native yang perlu dikompilasi, jadi aman untuk Jenkins dan deployment.
function connect(path) {
  if (typeof Bun !== 'undefined') {
    const { Database } = require('bun:sqlite');
    return new Database(path, { strict: true });
  }
  const { DatabaseSync } = require('node:sqlite');
  return new DatabaseSync(path);
}

// Membungkus statement agar get/all/run berperilaku sama di kedua runtime.
function wrap(raw) {
  return {
    exec: (sql) => raw.exec(sql),
    close: () => raw.close(),
    prepare(sql) {
      const stmt = raw.prepare(sql);
      return {
        get: (...args) => stmt.get(...args) ?? undefined,
        all: (...args) => stmt.all(...args),
        run: (...args) => stmt.run(...args),
      };
    },
  };
}

const readSql = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

// Akun uji untuk login. Ganti lewat SEED_USER_EMAIL dan SEED_USER_PASSWORD di .env.
function seedUser(db) {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM users').get();
  if (total > 0) return;
  const email = (process.env.SEED_USER_EMAIL || 'admin@skincare.test').trim().toLowerCase();
  const password = process.env.SEED_USER_PASSWORD || 'Admin123!';
  db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(
    'Pengguna Uji',
    email,
    hashPassword(password)
  );
}

export function openDatabase(path = ':memory:', { seed = true } = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const db = wrap(connect(path));
  db.exec('PRAGMA foreign_keys = ON;'); // wajib agar ON DELETE CASCADE berfungsi
  db.exec(readSql('./schema.sql'));

  const { total } = db.prepare('SELECT COUNT(*) AS total FROM products').get();
  if (seed && total === 0) db.exec(readSql('./seed.sql'));
  if (seed) seedUser(db);

  return db;
}
