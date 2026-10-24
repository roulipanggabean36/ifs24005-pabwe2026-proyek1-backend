import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

import { productRoutes } from './routes/productRoutes.js';
import { routineRoutes } from './routes/routineRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { requireAuth } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

// db      : hasil openDatabase()
// options : staticDir  = folder hasil build Vue (dist). Jika ada, disajikan oleh Express.
//           authSecret = kunci penanda tangan cookie sesi (AUTH_SECRET). Jika kosong dibuat acak
//                        sehingga semua sesi berakhir saat server restart.
export function createApp(db, { staticDir, authSecret = randomBytes(32).toString('hex') } = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    db.prepare('SELECT 1 AS ok').get();
    res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } });
  });

  app.use('/api/auth', authRoutes(db, authSecret));

  // Semua data skincare hanya untuk pengguna yang sudah masuk
  const protect = requireAuth(db, authSecret);
  app.use('/api/products', protect, productRoutes(db));
  app.use('/api/routines', protect, routineRoutes(db));
  app.use('/api', notFound);

  if (staticDir && existsSync(join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir));
    // Fallback untuk single page app: semua GET non-API mengembalikan index.html
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      return res.sendFile(join(staticDir, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
