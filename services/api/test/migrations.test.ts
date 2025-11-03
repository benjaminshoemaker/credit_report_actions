import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const composeFile = path.resolve(currentDir, '../docker-compose.test.yml');

const dockerAvailable = (() => {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

(dockerAvailable ? describe.sequential : describe.skip)('database migrations', () => {
  let db: Awaited<typeof import('../src/db.js')>;

  beforeAll(async () => {
    if (!fs.existsSync(composeFile)) {
      throw new Error('docker-compose file missing');
    }

    process.env.PGHOST = '127.0.0.1';
    process.env.PGPORT = '55432';
    process.env.PGDATABASE = 'aprcut_test';
    process.env.PGUSER = 'postgres';
    process.env.PGPASSWORD = 'postgres';

    execSync(`docker compose -f "${composeFile}" up -d`, { stdio: 'inherit' });

    // wait for postgres readiness by attempting connections
    const { Client } = await import('pg');
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const client = new Client({
          host: process.env.PGHOST,
          port: Number(process.env.PGPORT),
          database: process.env.PGDATABASE,
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD
        });
        await client.connect();
        await client.end();
        break;
      } catch (error) {
        if (attempt === 19) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    db = await import('../src/db.js');
  }, 60_000);

  afterAll(async () => {
    if (db) {
      await db.closePool();
    }
    execSync(`docker compose -f "${composeFile}" down -v`, { stdio: 'inherit' });
  }, 30_000);

  it('runs migrations and creates expected tables', async () => {
    await db.runMigrations();

    const client = await db.getClient();
    try {
      const { rows } = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
      );
      const tableNames = rows.map((row) => row.table_name);
      expect(tableNames).toEqual(expect.arrayContaining(['users', 'saved_items', 'events']));
    } finally {
      client.release();
    }
  });
});
