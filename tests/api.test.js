import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db/database.js';

let server;
let base;

async function start(app) {
  const instance = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  return { instance, url: `http://127.0.0.1:${instance.address().port}` };
}

const stop = (instance) => new Promise((resolve) => instance.close(resolve));

async function call(path, { method = 'GET', body, raw } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  return { status: response.status, body: await response.json() };
}

const isoFromNow = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

const newProduct = (overrides = {}) => ({
  name: 'Hada Labo Gokujyun Lotion',
  brand: 'Hada Labo',
  category: 'toner',
  expiry_date: isoFromNow(400),
  price: 85000,
  ...overrides,
});

beforeAll(async () => {
  const started = await start(createApp(openDatabase(':memory:')));
  server = started.instance;
  base = started.url;
});

afterAll(() => stop(server));

describe('GET /api/health', () => {
  it('mengembalikan status ok', async () => {
    const { status, body } = await call('/api/health');
    expect(status).toBe(200);
    expect(body.data.status).toBe('ok');
  });
});

describe('Products API', () => {
  it('mengembalikan semua produk beserta days_left', async () => {
    const { status, body } = await call('/api/products');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(5);
    expect(typeof body.data[0].days_left).toBe('number');
  });

  it('memfilter berdasarkan category dan search', async () => {
    const byCategory = await call('/api/products?category=sunscreen');
    expect(byCategory.body.data).toHaveLength(1);
    expect(byCategory.body.data[0].name).toBe('Implora Sunscreen SPF 40++');

    const bySearch = await call('/api/products?search=wardah');
    expect(bySearch.body.data).toHaveLength(2);

    const combined = await call('/api/products?category=cleanser&search=wardah');
    expect(combined.body.data).toHaveLength(1);
  });

  it('memfilter produk yang segera kedaluwarsa', async () => {
    const soon = await call('/api/products', {
      method: 'POST',
      body: newProduct({ name: 'Produk Hampir Habis', expiry_date: isoFromNow(10) }),
    });
    const later = await call('/api/products', {
      method: 'POST',
      body: newProduct({ name: 'Produk Masih Lama', expiry_date: isoFromNow(400) }),
    });
    expect(soon.status).toBe(201);
    expect(later.status).toBe(201);

    const { body } = await call('/api/products?expiring=30');
    const names = body.data.map((p) => p.name);
    expect(names).toContain('Produk Hampir Habis');
    expect(names).not.toContain('Produk Masih Lama');

    const invalid = await call('/api/products?expiring=abc');
    expect(invalid.status).toBe(400);
  });

  it('mengambil satu produk, 404 jika tidak ada, 400 jika id salah', async () => {
    const found = await call('/api/products/1');
    expect(found.status).toBe(200);
    expect(found.body.data.name).toBe('Wardah Facial Wash');

    expect((await call('/api/products/9999')).status).toBe(404);
    expect((await call('/api/products/abc')).status).toBe(400);
  });

  it('membuat, mengubah, lalu menghapus produk', async () => {
    const created = await call('/api/products', { method: 'POST', body: newProduct() });
    expect(created.status).toBe(201);
    expect(created.body.data.quantity).toBe(1);
    const id = created.body.data.id;

    const updated = await call(`/api/products/${id}`, {
      method: 'PUT',
      body: newProduct({ name: 'Hada Labo Premium', quantity: 3 }),
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Hada Labo Premium');
    expect(updated.body.data.quantity).toBe(3);

    const removed = await call(`/api/products/${id}`, { method: 'DELETE' });
    expect(removed.status).toBe(200);
    expect((await call(`/api/products/${id}`)).status).toBe(404);
  });

  it('menolak data tidak valid dan produk yang tidak ada', async () => {
    const invalid = await call('/api/products', { method: 'POST', body: { name: '' } });
    expect(invalid.status).toBe(400);
    expect(invalid.body.success).toBe(false);
    expect(invalid.body.errors.length).toBeGreaterThan(0);

    expect((await call('/api/products/9999', { method: 'PUT', body: newProduct() })).status).toBe(404);
    expect((await call('/api/products/9999', { method: 'DELETE' })).status).toBe(404);
    expect((await call('/api/products/1', { method: 'PUT', body: {} })).status).toBe(400);
  });

  it('menolak body JSON yang rusak', async () => {
    const { status, body } = await call('/api/products', { method: 'POST', raw: '{rusak' });
    expect(status).toBe(400);
    expect(body.message).toBe('Body JSON tidak valid');
  });

  it('menghapus produk ikut menghapus jurnalnya', async () => {
    const product = await call('/api/products', { method: 'POST', body: newProduct() });
    const productId = product.body.data.id;
    const routine = await call('/api/routines', {
      method: 'POST',
      body: { product_id: productId, used_at: '2026-10-22', time_of_day: 'night', skin_condition: 'good' },
    });
    expect(routine.status).toBe(201);

    await call(`/api/products/${productId}`, { method: 'DELETE' });
    expect((await call(`/api/routines/${routine.body.data.id}`)).status).toBe(404);
  });
});

describe('Routines API', () => {
  const newRoutine = (overrides = {}) => ({
    product_id: 1,
    used_at: '2026-10-22',
    time_of_day: 'night',
    skin_condition: 'good',
    skin_rating: 4,
    notes: 'Kulit terasa lembap',
    ...overrides,
  });

  it('mengembalikan jurnal beserta nama produk', async () => {
    const { status, body } = await call('/api/routines');
    expect(status).toBe(200);
    expect(body.data.length).toBeGreaterThanOrEqual(9);
    expect(typeof body.data[0].product_name).toBe('string');
  });

  it('memfilter berdasarkan date, time_of_day, dan product_id', async () => {
    const byDate = await call('/api/routines?date=2026-10-20');
    expect(byDate.body.data).toHaveLength(5);

    const byTime = await call('/api/routines?date=2026-10-20&time_of_day=night');
    expect(byTime.body.data).toHaveLength(2);

    const byProduct = await call('/api/routines?product_id=5');
    expect(byProduct.body.data).toHaveLength(2);
  });

  it('menolak filter yang tidak valid', async () => {
    expect((await call('/api/routines?date=kemarin')).status).toBe(400);
    expect((await call('/api/routines?time_of_day=siang')).status).toBe(400);
    expect((await call('/api/routines?product_id=abc')).status).toBe(400);
  });

  it('mengambil jurnal milik satu produk', async () => {
    const { status, body } = await call('/api/products/2/routines');
    expect(status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect((await call('/api/products/9999/routines')).status).toBe(404);
    expect((await call('/api/products/abc/routines')).status).toBe(400);
  });

  it('mengambil satu jurnal, 404 jika tidak ada', async () => {
    const found = await call('/api/routines/1');
    expect(found.status).toBe(200);
    expect(found.body.data.product_id).toBe(1);
    expect((await call('/api/routines/9999')).status).toBe(404);
  });

  it('membuat, mengubah, lalu menghapus jurnal', async () => {
    const created = await call('/api/routines', { method: 'POST', body: newRoutine() });
    expect(created.status).toBe(201);
    expect(created.body.data.product_name).toBe('Wardah Facial Wash');
    const id = created.body.data.id;

    const updated = await call(`/api/routines/${id}`, {
      method: 'PUT',
      body: newRoutine({ skin_condition: 'great', skin_rating: 5 }),
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.skin_condition).toBe('great');

    const removed = await call(`/api/routines/${id}`, { method: 'DELETE' });
    expect(removed.status).toBe(200);
    expect((await call(`/api/routines/${id}`)).status).toBe(404);
  });

  it('menolak jurnal yang tidak valid atau produk yang tidak ada', async () => {
    const invalid = await call('/api/routines', { method: 'POST', body: { product_id: 1 } });
    expect(invalid.status).toBe(400);

    const unknownProduct = await call('/api/routines', {
      method: 'POST',
      body: newRoutine({ product_id: 9999 }),
    });
    expect(unknownProduct.status).toBe(400);

    expect((await call('/api/routines/9999', { method: 'PUT', body: newRoutine() })).status).toBe(404);
    expect(
      (await call('/api/routines/1', { method: 'PUT', body: newRoutine({ product_id: 9999 }) })).status
    ).toBe(400);
    expect((await call('/api/routines/9999', { method: 'DELETE' })).status).toBe(404);
  });
});

describe('Penanganan error', () => {
  it('mengembalikan 404 JSON untuk endpoint yang tidak dikenal', async () => {
    const { status, body } = await call('/api/tidak-ada');
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });

  it('mengembalikan 500 untuk error yang tidak terduga', async () => {
    const brokenDb = {
      prepare() {
        throw new Error('database rusak');
      },
    };
    const started = await start(createApp(brokenDb));
    const original = console.error;
    console.error = () => {};
    try {
      const response = await fetch(`${started.url}/api/health`);
      const body = await response.json();
      expect(response.status).toBe(500);
      expect(body.message).toBe('Terjadi kesalahan pada server');
    } finally {
      console.error = original;
      await stop(started.instance);
    }
  });
});
