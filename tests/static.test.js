import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db/database.js';

const listen = (app) =>
  new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
const close = (s) => new Promise((resolve) => s.close(resolve));

let dir;
let withStatic;
let withoutStatic;
let staticUrl;
let plainUrl;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'skincare-dist-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Skincare</title><div id="app"></div>');

  withStatic = await listen(createApp(openDatabase(':memory:'), { staticDir: dir }));
  withoutStatic = await listen(createApp(openDatabase(':memory:')));
  staticUrl = `http://127.0.0.1:${withStatic.address().port}`;
  plainUrl = `http://127.0.0.1:${withoutStatic.address().port}`;
});

afterAll(async () => {
  await close(withStatic);
  await close(withoutStatic);
  rmSync(dir, { recursive: true, force: true });
});

describe('menyajikan hasil build Vue', () => {
  it('mengembalikan index.html pada halaman utama', async () => {
    const response = await fetch(`${staticUrl}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<div id="app">');
  });

  it('memakai fallback index.html untuk rute non-API', async () => {
    const response = await fetch(`${staticUrl}/halaman-apa-saja`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>Skincare</title>');
  });

  it('tetap mengembalikan JSON untuk API dan 404 untuk metode selain GET', async () => {
    const health = await fetch(`${staticUrl}/api/health`);
    expect((await health.json()).success).toBe(true);

    const products = await fetch(`${staticUrl}/api/products`);
    expect(products.status).toBe(401);

    const unknown = await fetch(`${staticUrl}/api/tidak-ada`);
    expect(unknown.status).toBe(404);

    const post = await fetch(`${staticUrl}/halaman-apa-saja`, { method: 'POST' });
    expect(post.status).toBe(404);
  });
});

describe('tanpa folder dist', () => {
  it('mengembalikan 404 JSON untuk halaman utama', async () => {
    const response = await fetch(`${plainUrl}/`);
    expect(response.status).toBe(404);
    expect((await response.json()).success).toBe(false);
  });
});
