import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import mysql from 'mysql2/promise';
import { DB_CLIENT, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, SQLITE_FILE } from './config.js';

export type SqlDialect = 'sqlite' | 'mysql';

/**
 * The narrow slice of database behaviour the controllers actually use. Keeping
 * it this small is what lets SQLite (local development) and MySQL (production)
 * sit behind the same calls.
 */
export interface SqlDatabase {
  readonly dialect: SqlDialect;
  get<T = any>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T = any[]>(sql: string, params?: unknown[]): Promise<T>;
  run(sql: string, params?: unknown[]): Promise<void>;
  /** Runs DDL. Statements may be separated by semicolons. */
  exec(sql: string): Promise<void>;
  /** Does a column exist? The two engines answer this very differently. */
  hasColumn(table: string, column: string): Promise<boolean>;
  /** Converts a JS Date into whatever this engine wants bound to a DATETIME. */
  toTimestamp(date: Date): unknown;
  close(): Promise<void>;
}

/** Splits a DDL blob into statements, ignoring the trailing empty chunk. */
function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// SQLite
// ---------------------------------------------------------------------------

async function createSqliteDatabase(): Promise<SqlDatabase> {
  const database = await open({
    filename: SQLITE_FILE,
    driver: sqlite3.Database
  });

  await database.run('PRAGMA foreign_keys = ON;');

  return {
    dialect: 'sqlite',
    get: (sql, params = []) => database.get(sql, params) as any,
    all: (sql, params = []) => database.all(sql, params) as any,
    run: async (sql, params = []) => { await database.run(sql, params); },
    exec: sql => database.exec(sql),
    hasColumn: async (table, column) => {
      const columns = await database.all(`PRAGMA table_info(${table})`);
      return columns.some((entry: { name: string }) => entry.name === column);
    },
    // SQLite has no date type; an ISO-8601 string keeps the value unambiguous.
    toTimestamp: date => date.toISOString(),
    close: () => database.close()
  };
}

// ---------------------------------------------------------------------------
// MySQL
// ---------------------------------------------------------------------------

async function createMysqlDatabase(): Promise<SqlDatabase> {
  const pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    // Store and read DATETIME as UTC so timestamps survive a server timezone change.
    timezone: 'Z',
    // Without this, SUM() comes back as a string and byte totals stop being numbers.
    decimalNumbers: true,
    charset: 'utf8mb4_general_ci'
  });

  // Fail fast with a clear message instead of on the first request.
  const connection = await pool.getConnection();
  connection.release();

  return {
    dialect: 'mysql',
    get: async (sql, params = []) => {
      const [rows] = await pool.query(sql, params);
      return (rows as any[])[0];
    },
    all: async (sql, params = []) => {
      const [rows] = await pool.query(sql, params);
      return rows as any;
    },
    run: async (sql, params = []) => { await pool.query(sql, params); },
    exec: async sql => {
      for (const statement of splitStatements(sql)) {
        await pool.query(statement);
      }
    },
    hasColumn: async (table, column) => {
      const [rows] = await pool.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
        [DB_NAME, table, column]
      );
      return (rows as any[]).length > 0;
    },
    // mysql2 serialises Date objects using the pool timezone (UTC, set above).
    toTimestamp: date => date,
    close: () => pool.end()
  };
}

export async function createDatabase(): Promise<SqlDatabase> {
  if (DB_CLIENT === 'mysql') {
    console.log(`Database: MySQL ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);
    return createMysqlDatabase();
  }

  console.log(`Database: SQLite ${path.resolve(SQLITE_FILE)}`);
  return createSqliteDatabase();
}
