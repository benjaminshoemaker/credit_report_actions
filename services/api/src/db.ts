import { Pool, type PoolClient } from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_CONFIG = {
  host: process.env.PGHOST ?? '127.0.0.1',
  port: Number(process.env.PGPORT ?? '5432'),
  database: process.env.PGDATABASE ?? 'postgres',
  user: process.env.PGUSER ?? 'postgres',
  password: process.env.PGPASSWORD ?? 'postgres',
  ssl: process.env.PGSSL === 'true',
  max: Number(process.env.PGPOOL_MAX ?? '5')
};

let pool: Pool | undefined;

const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool(DEFAULT_CONFIG);
  }

  return pool;
};

export const getClient = async (): Promise<PoolClient> => getPool().connect();

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
};

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(moduleDir, '../migrations');

let migrationsPromise: Promise<void> | null = null;

const readMigrationFiles = async (): Promise<string[]> => {
  const entries = await fs.readdir(migrationsDir);
  return entries
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => path.join(migrationsDir, file));
};

const applyMigration = async (client: PoolClient, filePath: string): Promise<void> => {
  const sql = await fs.readFile(filePath, 'utf8');
  await client.query(sql);
};

export const runMigrations = async (): Promise<void> => {
  const files = await readMigrationFiles();
  const client = await getClient();
  try {
    for (const file of files) {
      await applyMigration(client, file);
    }
  } finally {
    client.release();
  }
};

export const ensureMigrations = async (): Promise<void> => {
  if (!migrationsPromise) {
    migrationsPromise = runMigrations().catch((error) => {
      migrationsPromise = null;
      throw error;
    });
  }

  await migrationsPromise;
};
