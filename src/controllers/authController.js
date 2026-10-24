import { HttpError } from '../utils/httpError.js';
import { getSessionUser } from '../middleware/auth.js';
import { validateLogin } from '../utils/validators.js';
import { DUMMY_HASH, verifyPassword } from '../utils/password.js';
import { COOKIE_NAME, SESSION_SECONDS, createToken } from '../utils/session.js';

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

const publicUser = ({ id, name, email, created_at }) => ({ id, name, email, created_at });

export function authController(db, secret) {
  const failures = new Map(); // `${ip}|${email}` -> { count, firstAt }

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true' || Boolean(process.env.VERCEL),
    path: '/',
  };

  function isLocked(key, now) {
    const entry = failures.get(key);
    if (!entry) return false;
    if (now - entry.firstAt > WINDOW_MS) {
      failures.delete(key);
      return false;
    }
    return entry.count >= MAX_FAILURES;
  }

  function recordFailure(key, now) {
    const entry = failures.get(key);
    if (!entry || now - entry.firstAt > WINDOW_MS) failures.set(key, { count: 1, firstAt: now });
    else entry.count += 1;
  }

  return {
    login(req, res) {
      const { email, password } = validateLogin(req.body);
      const key = `${req.ip}|${email}`;
      const now = Date.now();

      if (isLocked(key, now)) {
        throw new HttpError(429, 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.');
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      const valid = verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
      if (!user || !valid) {
        recordFailure(key, now);
        // Pesan sama untuk email salah dan password salah agar akun tidak bisa ditebak
        throw new HttpError(401, 'Email atau kata sandi salah');
      }

      failures.delete(key);
      res.cookie(COOKIE_NAME, createToken(user.id, secret), {
        ...cookieOptions,
        maxAge: SESSION_SECONDS * 1000,
      });
      res.json({ success: true, data: { user: publicUser(user) } });
    },

    logout(req, res) {
      res.clearCookie(COOKIE_NAME, cookieOptions);
      res.json({ success: true, data: { loggedOut: true } });
    },

    // Cek sesi: selalu 200 agar pengunjung yang belum masuk tidak memicu error di console browser
    me(req, res) {
      const user = getSessionUser(db, secret, req);
      res.json({ success: true, data: { user: user ? publicUser(user) : null } });
    },
  };
}
