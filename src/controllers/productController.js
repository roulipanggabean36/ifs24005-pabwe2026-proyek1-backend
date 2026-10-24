import { HttpError } from '../utils/httpError.js';
import { parseId, validateProduct } from '../utils/validators.js';

// days_left dihitung di SQL agar front-end tinggal menampilkan badge kedaluwarsa
const SELECT_PRODUCT = `
  SELECT *,
    CAST(julianday(expiry_date) - julianday(date('now')) AS INTEGER) AS days_left
  FROM products
`;

export function productController(db) {
  const findOr404 = (id) => {
    const product = db.prepare(`${SELECT_PRODUCT} WHERE id = ?`).get(id);
    if (!product) throw new HttpError(404, 'Produk tidak ditemukan');
    return product;
  };

  return {
    getAll(req, res) {
      const { category, search, expiring } = req.query;
      const where = [];
      const params = {};

      if (category) {
        where.push('category = @category');
        params.category = category;
      }
      if (search) {
        where.push('(name LIKE @search OR brand LIKE @search)');
        params.search = `%${search}%`;
      }
      if (expiring !== undefined) {
        const days = Number.parseInt(expiring, 10);
        if (!Number.isInteger(days) || days < 0) {
          throw new HttpError(400, 'expiring harus bilangan bulat >= 0');
        }
        where.push("expiry_date <= date('now', '+' || @days || ' days')");
        params.days = days;
      }

      const sql =
        `${SELECT_PRODUCT} ` +
        (where.length ? `WHERE ${where.join(' AND ')} ` : '') +
        'ORDER BY expiry_date ASC, id ASC';

      const stmt = db.prepare(sql);
      const rows = where.length ? stmt.all(params) : stmt.all();
      res.json({ success: true, data: rows });
    },

    getOne(req, res) {
      res.json({ success: true, data: findOr404(parseId(req.params.id)) });
    },

    create(req, res) {
      const data = validateProduct(req.body);
      const info = db
        .prepare(
          `INSERT INTO products (name, brand, category, opened_date, expiry_date, quantity, price, notes)
           VALUES (@name, @brand, @category, @opened_date, @expiry_date, @quantity, @price, @notes)`
        )
        .run(data);

      res.status(201).json({ success: true, data: findOr404(Number(info.lastInsertRowid)) });
    },

    update(req, res) {
      const id = parseId(req.params.id);
      findOr404(id);
      const data = validateProduct(req.body);

      db.prepare(
        `UPDATE products SET
           name = @name, brand = @brand, category = @category,
           opened_date = @opened_date, expiry_date = @expiry_date,
           quantity = @quantity, price = @price, notes = @notes,
           updated_at = datetime('now')
         WHERE id = @id`
      ).run({ ...data, id });

      res.json({ success: true, data: findOr404(id) });
    },

    remove(req, res) {
      const id = parseId(req.params.id);
      const product = findOr404(id);
      db.prepare('DELETE FROM products WHERE id = ?').run(id); // jurnal ikut terhapus (CASCADE)
      res.json({ success: true, message: 'Produk berhasil dihapus', data: product });
    },
  };
}
