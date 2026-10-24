import { HttpError } from '../utils/httpError.js';
import { parseId, validateRoutine, isDate, TIMES } from '../utils/validators.js';

const SELECT_ROUTINE = `
  SELECT r.*, p.name AS product_name, p.brand AS product_brand
  FROM routines r
  JOIN products p ON p.id = r.product_id
`;

export function routineController(db) {
  const findOr404 = (id) => {
    const routine = db.prepare(`${SELECT_ROUTINE} WHERE r.id = ?`).get(id);
    if (!routine) throw new HttpError(404, 'Catatan jurnal tidak ditemukan');
    return routine;
  };

  const ensureProductExists = (productId) => {
    const exists = db.prepare('SELECT 1 AS ok FROM products WHERE id = ?').get(productId);
    if (!exists) throw new HttpError(400, 'product_id tidak ditemukan di tabel products');
  };

  return {
    getAll(req, res) {
      const { date, time_of_day, product_id } = req.query;
      const where = [];
      const params = {};

      if (date) {
        if (!isDate(date)) throw new HttpError(400, 'date harus berformat YYYY-MM-DD');
        where.push('r.used_at = @date');
        params.date = date;
      }
      if (time_of_day) {
        if (!TIMES.includes(time_of_day)) {
          throw new HttpError(400, 'time_of_day harus morning atau night');
        }
        where.push('r.time_of_day = @time_of_day');
        params.time_of_day = time_of_day;
      }
      if (product_id) {
        where.push('r.product_id = @product_id');
        params.product_id = parseId(product_id, 'product_id');
      }

      const sql =
        `${SELECT_ROUTINE} ` +
        (where.length ? `WHERE ${where.join(' AND ')} ` : '') +
        'ORDER BY r.used_at DESC, r.id DESC';

      const stmt = db.prepare(sql);
      const rows = where.length ? stmt.all(params) : stmt.all();
      res.json({ success: true, data: rows });
    },

    getByProduct(req, res) {
      const productId = parseId(req.params.id);
      const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
      if (!product) throw new HttpError(404, 'Produk tidak ditemukan');

      const rows = db
        .prepare(`${SELECT_ROUTINE} WHERE r.product_id = ? ORDER BY r.used_at DESC, r.id DESC`)
        .all(productId);
      res.json({ success: true, data: rows });
    },

    getOne(req, res) {
      res.json({ success: true, data: findOr404(parseId(req.params.id)) });
    },

    create(req, res) {
      const data = validateRoutine(req.body);
      ensureProductExists(data.product_id);

      const info = db
        .prepare(
          `INSERT INTO routines (product_id, used_at, time_of_day, skin_condition, skin_rating, notes)
           VALUES (@product_id, @used_at, @time_of_day, @skin_condition, @skin_rating, @notes)`
        )
        .run(data);

      res.status(201).json({ success: true, data: findOr404(Number(info.lastInsertRowid)) });
    },

    update(req, res) {
      const id = parseId(req.params.id);
      findOr404(id);
      const data = validateRoutine(req.body);
      ensureProductExists(data.product_id);

      db.prepare(
        `UPDATE routines SET
           product_id = @product_id, used_at = @used_at, time_of_day = @time_of_day,
           skin_condition = @skin_condition, skin_rating = @skin_rating, notes = @notes
         WHERE id = @id`
      ).run({ ...data, id });

      res.json({ success: true, data: findOr404(id) });
    },

    remove(req, res) {
      const id = parseId(req.params.id);
      const routine = findOr404(id);
      db.prepare('DELETE FROM routines WHERE id = ?').run(id);
      res.json({ success: true, message: 'Catatan jurnal berhasil dihapus', data: routine });
    },
  };
}
