import express from 'express';
import { authController } from '../controllers/authController.js';

export function authRoutes(db, secret) {
  const router = express.Router();
  const auth = authController(db, secret);

  router.post('/login', auth.login);
  router.post('/logout', auth.logout);
  router.get('/me', auth.me);

  return router;
}
