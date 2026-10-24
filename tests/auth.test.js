import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db/database.js';
import { hashPassword, verifyPassword } from '../src/utils/password.js';
import { createToken, verifyToken, parseCookies } from '../src/utils/session.js';
import { validateLogin } from '../src/utils/validators.js';

const SECRET = 'rahasia-uji';
let server;
let base;

async function post(path, body, headers = {}) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

const get = async (path, headers = {}) => {
  const response = await fetch(`${base}${path}`, { headers });
  return { status: response.status, body: await response.json() };
};

const login = (email = 'admin@skincare.test', password = 'Admin123!') =>
  post('/api/auth/login', { email, password });

beforeAll(async () => {
  const app = createApp(openDatabase(':memory:'), { authSecret: SECRET });
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

describe('POST /api/auth/login', () => {
  it('masuk dengan email dan password benar, cookie sesi httpOnly diset', async () => {
    const { response, body } = await login();
    expect(response.status).toBe(200);
    expect(body.data.user.email).toBe('admin@skincare.test');
    expect(body.data.user.password_hash).toBeUndefined();

    const cookie = response.headers.get('set-cookie');
    expect(cookie).toContain('session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('tidak membedakan huruf besar kecil dan spasi pada email', async () => {
    const { response } = await login('  ADMIN@Skincare.Test ');
    expect(response.status).toBe(200);
  });

  it('menolak password salah dan email tidak terdaftar dengan pesan yang sama', async () => {
    const wrongPassword = await login('admin@skincare.test', 'salah-banget');
    const unknownEmail = await login('tidak.ada@skincare.test', 'Admin123!');
    expect(wrongPassword.response.status).toBe(401);
    expect(unknownEmail.response.status).toBe(401);
    expect(wrongPassword.body.message).toBe('Email atau kata sandi salah');
    expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    expect(wrongPassword.response.headers.get('set-cookie')).toBeNull();
  });

  it('menolak input tidak valid dengan 400', async () => {
    const empty = await post('/api/auth/login', {});
    expect(empty.response.status).toBe(400);
    expect(empty.body.errors).toContain('email wajib diisi');
    expect(empty.body.errors).toContain('password wajib diisi');

    const badEmail = await login('bukan-email', 'x');
    expect(badEmail.response.status).toBe(400);
    expect(badEmail.body.errors).toContain('email tidak valid');

    const notText = await post('/api/auth/login', { email: 123, password: ['a'] });
    expect(notText.response.status).toBe(400);
  });

  it('memblokir sementara setelah 5 kali gagal untuk email yang sama', async () => {
    const email = 'korban@skincare.test';
    for (let i = 0; i < 5; i += 1) {
      expect((await login(email, 'salah')).response.status).toBe(401);
    }
    expect((await login(email, 'salah')).response.status).toBe(429);
    // email lain tidak ikut terblokir
    expect((await login()).response.status).toBe(200);
  });
});

describe('akses endpoint terproteksi', () => {
  it('menolak permintaan tanpa cookie sesi', async () => {
    for (const path of ['/api/products', '/api/routines', '/api/products/1/routines']) {
      const { status, body } = await get(path);
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    }
  });

  it('/api/auth/me membalas 200 dengan user null untuk pengunjung (tanpa error di console browser)', async () => {
    const { status, body } = await get('/api/auth/me');
    expect(status).toBe(200);
    expect(body.data.user).toBeNull();
    const forged = await get('/api/auth/me', { Cookie: 'session=abc' });
    expect(forged.body.data.user).toBeNull();
  });

  it('tetap membuka /api/health tanpa login', async () => {
    expect((await get('/api/health')).status).toBe(200);
  });

  it('mengizinkan akses dengan cookie sesi dan mengembalikan profil di /me', async () => {
    const { response } = await login();
    const cookie = response.headers.get('set-cookie').split(';')[0];

    const products = await get('/api/products', { Cookie: cookie });
    expect(products.status).toBe(200);

    const me = await get('/api/auth/me', { Cookie: cookie });
    expect(me.status).toBe(200);
    expect(me.body.data.user.name).toBe('Pengguna Uji');
  });

  it('menolak cookie palsu, rusak, dan yang ditandatangani kunci lain', async () => {
    const forged = createToken(1, 'kunci-lain');
    for (const value of ['session=abc', `session=${forged}`, 'session=', 'lain=1']) {
      expect((await get('/api/products', { Cookie: value })).status).toBe(401);
    }
  });

  it('menolak sesi milik pengguna yang sudah tidak ada', async () => {
    const ghost = createToken(9999, SECRET);
    expect((await get('/api/products', { Cookie: `session=${ghost}` })).status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('menghapus cookie sesi', async () => {
    const { response, body } = await post('/api/auth/logout', {});
    expect(response.status).toBe(200);
    expect(body.data.loggedOut).toBe(true);
    expect(response.headers.get('set-cookie')).toMatch(/session=;/);
  });
});

describe('utilitas password', () => {
  it('hash berbeda tiap kali (salt acak) tetapi sama-sama bisa diverifikasi', () => {
    const a = hashPassword('rahasia');
    const b = hashPassword('rahasia');
    expect(a).not.toBe(b);
    expect(verifyPassword('rahasia', a)).toBe(true);
    expect(verifyPassword('RAHASIA', a)).toBe(false);
  });

  it('menolak format hash yang tidak dikenal', () => {
    expect(verifyPassword('x', undefined)).toBe(false);
    expect(verifyPassword('x', 'plain-text')).toBe(false);
    expect(verifyPassword('x', 'bcrypt$a$b')).toBe(false);
  });
});

describe('utilitas sesi', () => {
  it('token valid mengembalikan id dan kedaluwarsa setelah 7 hari', () => {
    const now = Date.now();
    const token = createToken(7, SECRET, now);
    expect(verifyToken(token, SECRET, now)).toBe(7);
    expect(verifyToken(token, SECRET, now + 6 * 86400000)).toBe(7);
    expect(verifyToken(token, SECRET, now + 8 * 86400000)).toBeNull();
  });

  it('menolak token yang diubah, berformat salah, atau bukan string', () => {
    const token = createToken(7, SECRET);
    const [payload, signature] = token.split('.');
    const tampered = Buffer.from(JSON.stringify({ uid: 1, exp: 9999999999 })).toString('base64url');
    expect(verifyToken(`${tampered}.${signature}`, SECRET)).toBeNull();
    expect(verifyToken(`${payload}.`, SECRET)).toBeNull();
    expect(verifyToken(`${payload}.pendek`, SECRET)).toBeNull();
    expect(verifyToken(undefined, SECRET)).toBeNull();
    expect(verifyToken('tanpa-titik', SECRET)).toBeNull();
  });

  it('menolak payload yang bertanda tangan benar tetapi isinya tidak masuk akal', async () => {
    const { createHmac } = await import('node:crypto');
    const forge = (raw) => {
      const payload = Buffer.from(raw).toString('base64url');
      return `${payload}.${createHmac('sha256', SECRET).update(payload).digest('base64url')}`;
    };
    expect(verifyToken(forge('bukan json'), SECRET)).toBeNull();
    expect(verifyToken(forge(JSON.stringify({ uid: 'satu', exp: 9999999999 })), SECRET)).toBeNull();
  });

  it('membaca cookie dengan benar', () => {
    expect(parseCookies('a=1; session=abc%20d; b=2')).toEqual({ a: '1', session: 'abc d', b: '2' });
    expect(parseCookies('rusak; =x; c=%E0%A4%A')).toEqual({ c: '%E0%A4%A' });
    expect(parseCookies(undefined)).toEqual({});
  });
});

describe('validateLogin', () => {
  it('menormalkan email dan menolak password terlalu panjang', () => {
    expect(validateLogin({ email: ' A@B.co ', password: 'x' })).toEqual({ email: 'a@b.co', password: 'x' });
    expect(() => validateLogin({ email: 'a@b.co', password: 'x'.repeat(129) })).toThrow('Validasi gagal');
    expect(() => validateLogin()).toThrow('Validasi gagal');
  });
});
