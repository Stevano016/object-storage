import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { createDatabase } from './database.js';
import type { SqlDatabase } from './database.js';

export type UserRole = 'superadmin' | 'user';

/** What an anonymous visitor holding a share link may do. */
export type SharePermission = 'viewer' | 'editor';

export const BCRYPT_ROUNDS = 10;

export const DEFAULT_ADMIN_USERNAME = 'admin';
export const DEFAULT_ADMIN_PASSWORD = 'admingentan123';

let db: SqlDatabase;

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  return bcrypt.hash(plain, salt);
}

// ---------------------------------------------------------------------------
// Schema — same shape on both engines, spelled the way each one wants it.
// ---------------------------------------------------------------------------

const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS buckets (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    is_public INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    bucket_id TEXT NOT NULL,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    physical_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(bucket_id) REFERENCES buckets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    bucket_id TEXT NOT NULL,
    file_id TEXT,
    permission TEXT NOT NULL DEFAULT 'viewer',
    label TEXT,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(bucket_id) REFERENCES buckets(id) ON DELETE CASCADE,
    FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_files_bucket ON files(bucket_id);
  CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
  CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token);
  CREATE INDEX IF NOT EXISTS idx_shares_bucket ON shares(bucket_id);
`;

// MySQL needs explicit lengths on indexed columns, and it has no
// "CREATE INDEX IF NOT EXISTS", so every index is declared inline.
const MYSQL_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE IF NOT EXISTS buckets (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(63) NOT NULL UNIQUE,
    is_public TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE IF NOT EXISTS files (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    bucket_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(512) NOT NULL,
    mime_type VARCHAR(191) NOT NULL,
    size BIGINT NOT NULL,
    physical_path VARCHAR(1024) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_files_bucket (bucket_id),
    KEY idx_files_name (name),
    CONSTRAINT fk_files_bucket FOREIGN KEY (bucket_id) REFERENCES buckets(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE IF NOT EXISTS shares (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    token VARCHAR(64) NOT NULL UNIQUE,
    bucket_id VARCHAR(36) NOT NULL,
    file_id VARCHAR(36) NULL,
    permission VARCHAR(16) NOT NULL DEFAULT 'viewer',
    label VARCHAR(255) NULL,
    expires_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_shares_bucket (bucket_id),
    KEY idx_shares_file (file_id),
    CONSTRAINT fk_shares_bucket FOREIGN KEY (bucket_id) REFERENCES buckets(id) ON DELETE CASCADE,
    CONSTRAINT fk_shares_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function createSchema(database: SqlDatabase) {
  await database.exec(database.dialect === 'mysql' ? MYSQL_SCHEMA : SQLITE_SCHEMA);
}

// ---------------------------------------------------------------------------
// Migrations & seeding
// ---------------------------------------------------------------------------

async function runMigrations(database: SqlDatabase) {
  // v2: role-based access control. Older databases only had a single admin account.
  if (!(await database.hasColumn('users', 'role'))) {
    const columnType = database.dialect === 'mysql' ? 'VARCHAR(20)' : 'TEXT';
    await database.exec(`ALTER TABLE users ADD COLUMN role ${columnType} NOT NULL DEFAULT 'user'`);
    // Every pre-existing account was an unrestricted admin, so keep it that way.
    await database.run(`UPDATE users SET role = 'superadmin'`);
    console.log('MIGRATION: users.role added; existing accounts promoted to superadmin.');
  }

  // Never leave the instance without a superadmin (e.g. after a botched manual edit).
  const superadmin = await database.get(`SELECT id FROM users WHERE role = 'superadmin' LIMIT 1`);
  if (!superadmin) {
    const oldest = await database.get('SELECT id FROM users ORDER BY created_at ASC LIMIT 1');
    if (oldest) {
      await database.run(`UPDATE users SET role = 'superadmin' WHERE id = ?`, [oldest.id]);
      console.log('MIGRATION: no superadmin found; promoted the oldest account.');
    }
  }
}

export async function seedDefaultSuperadmin(database: SqlDatabase) {
  const anyUser = await database.get('SELECT id FROM users LIMIT 1');
  if (anyUser) return false;

  await database.run(
    'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
    [uuidv4(), DEFAULT_ADMIN_USERNAME, await hashPassword(DEFAULT_ADMIN_PASSWORD), 'superadmin']
  );

  console.log('==================================================');
  console.log('SEED: Default superadmin user created!');
  console.log(`Username: ${DEFAULT_ADMIN_USERNAME}`);
  console.log(`Password: ${DEFAULT_ADMIN_PASSWORD}`);
  console.log('PLEASE CHANGE THIS PASSWORD ON YOUR FIRST LOGIN.');
  console.log('==================================================');
  return true;
}

/** Schema plus migrations, without seeding — what a data import needs. */
export async function ensureSchema(database: SqlDatabase) {
  await createSchema(database);
  await runMigrations(database);
}

/** Everything a freshly started server needs, seeding included. */
export async function prepareDatabase(database: SqlDatabase) {
  await ensureSchema(database);
  await seedDefaultSuperadmin(database);
}

export async function initDb(): Promise<SqlDatabase> {
  // The local storage provider and the multer landing zone both live here, so
  // these directories are needed regardless of which database engine is used.
  const dataDir = path.resolve('data');
  const storageDir = path.join(dataDir, 'storage');

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

  db = await createDatabase();
  await prepareDatabase(db);

  return db;
}

export function getDb(): SqlDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}
