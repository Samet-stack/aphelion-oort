import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { logger, serializeError } from './services/logger.js';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHEMA_FILE = path.join(__dirname, '../supabase/siteflow_schema.sql');

let pool;

const getPool = () => {
  const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'SUPABASE_DB_URL (ou DATABASE_URL) est requis pour se connecter a PostgreSQL.'
    );
  }

  if (!pool) {
    const isLocal =
      databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
    let connectionString = databaseUrl;

    if (!isLocal) {
      try {
        const parsed = new URL(databaseUrl);
        parsed.searchParams.delete('sslmode');
        connectionString = parsed.toString();
      } catch {
        connectionString = databaseUrl;
      }
    }

    pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 20,                    // Maximum 20 connections
      idleTimeoutMillis: 30000,   // Close idle connections after 30s
      connectionTimeoutMillis: 2000, // Timeout if cannot connect within 2s
      allowExitOnIdle: true       // Allow process to exit if all connections idle
    });
  }

  return pool;
};

const normalizeSql = (sql) => {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
};

const toCamel = (key) => key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const toCamelObject = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [toCamel(k), v]));

const mapRows = (rows) => rows.map(toCamelObject);
const queryWithClient = async (client, sql, params = []) => {
  const result = await client.query(normalizeSql(sql), params);
  return mapRows(result.rows);
};

const getWithClient = async (client, sql, params = []) => {
  const result = await client.query(normalizeSql(sql), params);
  if (result.rows.length === 0) return undefined;
  return toCamelObject(result.rows[0]);
};

const runWithClient = async (client, sql, params = []) => {
  const result = await client.query(normalizeSql(sql), params);
  return {
    changes: result.rowCount ?? 0
  };
};

// Export getPool pour les migrations
export { getPool };

export const initDb = async () => {
  const db = getPool();

  logger.info('Initializing PostgreSQL/Supabase schema');

  try {
    const schemaSql = await readFile(SCHEMA_FILE, 'utf-8');
    await db.query(schemaSql);
    logger.info('PostgreSQL schema initialized successfully');
  } catch (error) {
    logger.error('PostgreSQL schema initialization failed', {
      error: serializeError(error),
    });
    throw error;
  }
};

export const query = async (sql, params = []) => {
  const db = getPool();
  return queryWithClient(db, sql, params);
};

export const get = async (sql, params = []) => {
  const db = getPool();
  return getWithClient(db, sql, params);
};

export const run = async (sql, params = []) => {
  const db = getPool();
  return runWithClient(db, sql, params);
};

export const withTransaction = async (callback) => {
  const db = getPool();
  const client = await db.connect();

  const tx = {
    query: (sql, params = []) => queryWithClient(client, sql, params),
    get: (sql, params = []) => getWithClient(client, sql, params),
    run: (sql, params = []) => runWithClient(client, sql, params),
  };

  try {
    await client.query('BEGIN');
    const result = await callback(tx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error('Transaction rollback error', {
        error: serializeError(rollbackError),
      });
    }
    throw error;
  } finally {
    client.release();
  }
};

export const closeDb = async () => {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
};
