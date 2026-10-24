import { HttpError } from './httpError.js';

export const CATEGORIES = ['cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen', 'mask', 'other'];
export const TIMES = ['morning', 'night'];
export const CONDITIONS = ['great', 'good', 'normal', 'dry', 'oily', 'breakout', 'irritated'];

// Format YYYY-MM-DD dan benar-benar tanggal yang ada di kalender (2026-02-31 ditolak).
export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;

export function parseId(value, label = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, `${label} harus berupa bilangan bulat positif`);
  }
  return id;
}

export function validateProduct(body = {}) {
  const errors = [];
  if (!isText(body.name)) errors.push('name wajib diisi');
  if (!isText(body.brand)) errors.push('brand wajib diisi');
  if (!CATEGORIES.includes(body.category)) {
    errors.push(`category harus salah satu dari: ${CATEGORIES.join(', ')}`);
  }
  if (!isDate(body.expiry_date)) errors.push('expiry_date wajib berformat YYYY-MM-DD');
  if (body.opened_date != null && !isDate(body.opened_date)) {
    errors.push('opened_date harus berformat YYYY-MM-DD');
  }
  if (isDate(body.opened_date) && isDate(body.expiry_date) && body.opened_date > body.expiry_date) {
    errors.push('opened_date tidak boleh setelah expiry_date');
  }
  const quantity = body.quantity ?? 1;
  if (!isNonNegInt(quantity)) errors.push('quantity harus bilangan bulat >= 0');
  if (body.price != null && !isNonNegInt(body.price)) {
    errors.push('price harus bilangan bulat >= 0');
  }

  if (errors.length) throw new HttpError(400, 'Validasi gagal', errors);

  return {
    name: body.name.trim(),
    brand: body.brand.trim(),
    category: body.category,
    opened_date: body.opened_date ?? null,
    expiry_date: body.expiry_date,
    quantity,
    price: body.price ?? null,
    notes: body.notes ?? null,
  };
}

export function validateRoutine(body = {}) {
  const errors = [];
  if (!Number.isInteger(body.product_id) || body.product_id <= 0) {
    errors.push('product_id wajib berupa bilangan bulat positif');
  }
  if (!isDate(body.used_at)) errors.push('used_at wajib berformat YYYY-MM-DD');
  if (!TIMES.includes(body.time_of_day)) {
    errors.push(`time_of_day harus salah satu dari: ${TIMES.join(', ')}`);
  }
  if (!CONDITIONS.includes(body.skin_condition)) {
    errors.push(`skin_condition harus salah satu dari: ${CONDITIONS.join(', ')}`);
  }
  if (
    body.skin_rating != null &&
    !(Number.isInteger(body.skin_rating) && body.skin_rating >= 1 && body.skin_rating <= 5)
  ) {
    errors.push('skin_rating harus bilangan bulat 1 sampai 5');
  }

  if (errors.length) throw new HttpError(400, 'Validasi gagal', errors);

  return {
    product_id: body.product_id,
    used_at: body.used_at,
    time_of_day: body.time_of_day,
    skin_condition: body.skin_condition,
    skin_rating: body.skin_rating ?? null,
    notes: body.notes ?? null,
  };
}
