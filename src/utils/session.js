import { createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE_NAME = 'session';
export const SESSION_SECONDS = 60 * 60 * 24 * 7; // 7 hari

const sign = (data, secret) => createHmac('sha256', secret).update(data).digest('base64url');

// Token: base64url(JSON{uid, exp}) + '.' + HMAC-SHA256
export function createToken(userId, secret, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Math.floor(now / 1000) + SESSION_SECONDS })
  ).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

// Mengembalikan id pengguna, atau null jika token rusak, dipalsukan, atau kedaluwarsa.
export function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isInteger(uid) || typeof exp !== 'number' || exp * 1000 < now) return null;
    return uid;
  } catch {
    return null;
  }
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (!name || name in cookies) continue;
    try {
      cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      cookies[name] = part.slice(index + 1).trim();
    }
  }
  return cookies;
}
