import { describe, it, expect } from 'vitest';
import {
  isDate,
  parseId,
  validateProduct,
  validateRoutine,
} from '../src/utils/validators.js';

function catchError(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return null;
}

const validProduct = {
  name: '  Wardah Facial Wash ',
  brand: 'Wardah',
  category: 'cleanser',
  expiry_date: '2027-08-01',
};

const validRoutine = {
  product_id: 1,
  used_at: '2026-10-22',
  time_of_day: 'morning',
  skin_condition: 'good',
};

describe('isDate', () => {
  it('menerima tanggal kalender yang valid', () => {
    expect(isDate('2026-10-22')).toBe(true);
    expect(isDate('2024-02-29')).toBe(true);
  });

  it('menolak format atau tanggal yang tidak ada', () => {
    expect(isDate('2026-02-31')).toBe(false);
    expect(isDate('2026-13-01')).toBe(false);
    expect(isDate('22-10-2026')).toBe(false);
    expect(isDate(20261022)).toBe(false);
    expect(isDate(undefined)).toBe(false);
  });
});

describe('parseId', () => {
  it('mengubah string angka menjadi id', () => {
    expect(parseId('7')).toBe(7);
  });

  it('melempar error 400 untuk id yang tidak valid', () => {
    const error = catchError(() => parseId('abc', 'product_id'));
    expect(error.status).toBe(400);
    expect(error.message).toContain('product_id');
    expect(catchError(() => parseId('0')).status).toBe(400);
    expect(catchError(() => parseId('1.5')).status).toBe(400);
  });
});

describe('validateProduct', () => {
  it('merapikan data dan mengisi nilai default', () => {
    const data = validateProduct(validProduct);
    expect(data.name).toBe('Wardah Facial Wash');
    expect(data.quantity).toBe(1);
    expect(data.opened_date).toBeNull();
    expect(data.price).toBeNull();
    expect(data.notes).toBeNull();
  });

  it('mengumpulkan semua pesan kesalahan', () => {
    const error = catchError(() => validateProduct({ name: '', category: 'lipstik' }));
    expect(error.status).toBe(400);
    expect(error.message).toBe('Validasi gagal');
    expect(error.details).toContain('name wajib diisi');
    expect(error.details).toContain('brand wajib diisi');
    expect(error.details).toContain('expiry_date wajib berformat YYYY-MM-DD');
    expect(error.details).toHaveLength(4);
  });

  it('memeriksa tanggal buka, jumlah, dan harga', () => {
    const error = catchError(() =>
      validateProduct({
        ...validProduct,
        opened_date: '2028-01-01',
        quantity: -1,
        price: 1.5,
      })
    );
    expect(error.details).toContain('opened_date tidak boleh setelah expiry_date');
    expect(error.details).toContain('quantity harus bilangan bulat >= 0');
    expect(error.details).toContain('price harus bilangan bulat >= 0');

    const badFormat = catchError(() => validateProduct({ ...validProduct, opened_date: 'kemarin' }));
    expect(badFormat.details).toContain('opened_date harus berformat YYYY-MM-DD');
  });

  it('menerima body kosong sebagai input tidak valid', () => {
    expect(catchError(() => validateProduct()).status).toBe(400);
  });
});

describe('validateRoutine', () => {
  it('menerima data jurnal yang valid', () => {
    const data = validateRoutine({ ...validRoutine, skin_rating: 5, notes: 'glowing' });
    expect(data.skin_rating).toBe(5);
    expect(data.notes).toBe('glowing');
    expect(validateRoutine(validRoutine).skin_rating).toBeNull();
  });

  it('menolak data jurnal yang tidak valid', () => {
    const error = catchError(() =>
      validateRoutine({
        product_id: 'satu',
        used_at: 'hari ini',
        time_of_day: 'siang',
        skin_condition: 'kusam',
        skin_rating: 9,
      })
    );
    expect(error.status).toBe(400);
    expect(error.details).toHaveLength(5);
    expect(catchError(() => validateRoutine()).status).toBe(400);
  });
});
