import { HttpError } from '../utils/httpError.js';

export function notFound(req, res, next) {
  next(new HttpError(404, `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`));
}

// Express mengenali error handler dari 4 parameter, jadi parameter next harus tetap ada.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Body JSON tidak valid' });
  }
  if (err instanceof HttpError) {
    const body = { success: false, message: err.message };
    if (err.details) body.errors = err.details;
    return res.status(err.status).json(body);
  }
  console.error(err);
  return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
}
