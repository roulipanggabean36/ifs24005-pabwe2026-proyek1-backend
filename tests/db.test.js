import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/db/database.js';

const count = (db, table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

describe('openDatabase', () => {
  it('membuat skema dan mengisi dummy data produk nyata', () => {
    const db = openDatabase(':memory:');
    expect(count(db, 'products')).toBe(5);
    expect(count(db, 'routines')).toBe(9);

    const names = db.prepare('SELECT name FROM products').all().map((row) => row.name);
    expect(names).toContain('Wardah Facial Wash');
    expect(names).toContain('Implora Sunscreen SPF 40++');
    expect(names).toContain('Glowies Dreamy Moisturizer');
  });

  it('tidak mengisi dummy data jika seed dimatikan', () => {
    const db = openDatabase(':memory:', { seed: false });
    expect(count(db, 'products')).toBe(0);
    expect(count(db, 'users')).toBe(0);
  });

  it('membuat akun uji dengan password ter-hash', () => {
    const db = openDatabase(':memory:');
    const user = db.prepare('SELECT * FROM users').get();
    expect(count(db, 'users')).toBe(1);
    expect(user.email).toBe('admin@skincare.test');
    expect(user.password_hash.startsWith('scrypt$')).toBe(true);
    expect(user.password_hash).not.toContain('Admin123!');
  });

  it('get mengembalikan undefined jika baris tidak ada', () => {
    const db = openDatabase(':memory:');
    expect(db.prepare('SELECT * FROM products WHERE id = ?').get(9999)).toBeUndefined();
  });

  it('menghapus produk ikut menghapus jurnalnya (ON DELETE CASCADE)', () => {
    const db = openDatabase(':memory:');
    const before = db.prepare('SELECT COUNT(*) AS n FROM routines WHERE product_id = 1').get().n;
    expect(before).toBeGreaterThan(0);

    db.prepare('DELETE FROM products WHERE id = ?').run(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM routines WHERE product_id = 1').get().n).toBe(0);
  });

  it('menolak jurnal untuk produk yang tidak ada (foreign key)', () => {
    const db = openDatabase(':memory:');
    const insert = () =>
      db
        .prepare(
          `INSERT INTO routines (product_id, used_at, time_of_day, skin_condition)
           VALUES (?, '2026-10-22', 'morning', 'good')`
        )
        .run(9999);
    expect(insert).toThrow();
  });

  it('membuat file database di folder baru dan tidak menggandakan seed saat dibuka ulang', () => {
    const dir = mkdtempSync(join(tmpdir(), 'skincare-'));
    const file = join(dir, 'nested', 'test.db');
    try {
      const first = openDatabase(file);
      expect(count(first, 'products')).toBe(5);
      first.close();

      const second = openDatabase(file);
      expect(count(second, 'products')).toBe(5);
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
