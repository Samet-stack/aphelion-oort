import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

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
      ssl: isLocal ? false : { rejectUnauthorized: false }
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

// Export getPool pour les migrations
export { getPool };

export const initDb = async () => {
  const db = getPool();

  console.log('📦 Initialisation PostgreSQL/Supabase...');

  try {
    const schemaSql = await readFile(SCHEMA_FILE, 'utf-8');
    await db.query(schemaSql);
    console.log('✅ Base PostgreSQL initialisée avec succès');
  } catch (error) {
    console.error('❌ Erreur initialisation PostgreSQL:', error.message);
    throw error;
  }
};

export const query = async (sql, params = []) => {
  const db = getPool();
  const result = await db.query(normalizeSql(sql), params);
  return mapRows(result.rows);
};

export const get = async (sql, params = []) => {
  const db = getPool();
  const result = await db.query(normalizeSql(sql), params);
  if (result.rows.length === 0) return undefined;
  return toCamelObject(result.rows[0]);
};

export const run = async (sql, params = []) => {
  const db = getPool();
  const result = await db.query(normalizeSql(sql), params);
  return {
    changes: result.rowCount ?? 0
  };
};

export const closeDb = async () => {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
};
