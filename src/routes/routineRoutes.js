import express from 'express';
import { routineController } from '../controllers/routineController.js';

export function routineRoutes(db) {
  const router = express.Router();
  const routine = routineController(db);

  router.get('/', routine.getAll);
  router.get('/:id', routine.getOne);
  router.post('/', routine.create);
  router.put('/:id', routine.update);
  router.delete('/:id', routine.remove);

  return router;
}
