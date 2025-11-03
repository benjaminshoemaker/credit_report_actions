import { ensureMigrations, closePool } from './db.js';

try {
  await ensureMigrations();
  await closePool();
  console.log('Migrations completed');
} catch (error) {
  console.error('Migration failed', error);
  await closePool();
  process.exitCode = 1;
}
