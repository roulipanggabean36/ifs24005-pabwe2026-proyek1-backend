import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { productRoutes } from './routes/productRoutes.js';
import { routineRoutes } from './routes/routineRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

// db      : hasil openDatabase()
// options : staticDir = folder hasil build Vue (dist). Jika ada, disajikan oleh Express.
export function createApp(db, { staticDir } = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    db.prepare('SELECT 1 AS ok').get();
    res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } });
  });

  app.use('/api/products', productRoutes(db));
  app.use('/api/routines', routineRoutes(db));
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
