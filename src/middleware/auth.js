import { HttpError } from '../utils/httpError.js';
import { COOKIE_NAME, parseCookies, verifyToken } from '../utils/session.js';

// Pengguna dari cookie sesi yang valid, atau undefined jika tidak ada/tidak sah.
export function getSessionUser(db, secret, req) {
  const userId = verifyToken(parseCookies(req.headers.cookie)[COOKIE_NAME], secret);
  if (!userId) return undefined;
  return db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(userId);
}

// Menempelkan req.user jika cookie sesi valid, jika tidak balas 401.
export function requireAuth(db, secret) {
  return (req, res, next) => {
    const user = getSessionUser(db, secret, req);
    if (!user) return next(new HttpError(401, 'Silakan masuk terlebih dahulu'));
    req.user = user;
    return next();
  };
}
