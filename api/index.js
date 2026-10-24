// Titik masuk Vercel: seluruh permintaan /api/* diteruskan ke aplikasi Express yang sama dengan server lokal.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db/database.js';

// Vercel hanya mengizinkan menulis di folder sementara, jadi database SQLite ditaruh di sana.
// Isinya hilang saat fungsi dimulai ulang dan terisi dummy data lagi (SEED=false untuk menonaktifkan).
const dbPath = process.env.DB_PATH || join(tmpdir(), 'skincare.db');
const db = openDatabase(dbPath, { seed: process.env.SEED !== 'false' });

// AUTH_SECRET wajib diisi di Vercel agar cookie login valid di semua instance fungsi.
export default createApp(db, { authSecret: process.env.AUTH_SECRET || undefined });