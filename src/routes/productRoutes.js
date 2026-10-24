import express from 'express';
import { productController } from '../controllers/productController.js';
import { routineController } from '../controllers/routineController.js';

export function productRoutes(db) {
  const router = express.Router();
  const product = productController(db);
  const routine = routineController(db);

  router.get('/', product.getAll);
  router.get('/:id', product.getOne);
  router.post('/', product.create);
  router.put('/:id', product.update);
  router.delete('/:id', product.remove);

  // Relasi: semua jurnal milik satu produk
  router.get('/:id/routines', routine.getByProduct);

  return router;
}
