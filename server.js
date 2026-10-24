// Entry point back-end: menjalankan REST API dan menyajikan hasil build front-end (frontend/dist).
import { fileURLToPath } from 'node:url';

// .env dibaca dari folder tempat perintah dijalankan dan dari folder backend (keduanya opsional).
for (const file of ['.env', fileURLToPath(new URL('./.env', import.meta.url))]) {
  try {
    process.loadEnvFile?.(file);
  } catch {
    // File .env bersifat opsional, nilai default dipakai jika tidak ada.
  }
}

const { openDatabase } = await import('./src/db/database.js');
const { createApp } = await import('./src/app.js');

const PORT = process.env.PORT || process.env.APP_PORT || 3000;
const dbPath = process.env.DB_PATH || fileURLToPath(new URL('./data/skincare.db', import.meta.url));
const db = openDatabase(dbPath, { seed: process.env.SEED !== 'false' });
const staticDir = fileURLToPath(new URL('../frontend/dist', import.meta.url));

createApp(db, { staticDir }).listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
