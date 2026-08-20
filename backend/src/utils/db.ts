import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { createDatabase } from './database.js';
import { mimeTypeFromFilename } from './mimeTypes.js';
import type { SqlDatabase } from './database.js';

export type UserRole = 'superadmin' | 'user';

/** What an anonymous visitor holding a share link may do. */
export type SharePermission = 'viewer' | 'uploader' | 'editor';

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
    password_changed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS buckets (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    is_public INTEGER DEFAULT 0,
    quota_bytes INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    bucket_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(bucket_id) REFERENCES buckets(id) ON DELETE CASCADE,
    FOREIGN KEY(parent_id) REFERENCES folders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    bucket_id TEXT NOT NULL,
    folder_id TEXT,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    physical_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(bucket_id) REFERENCES buckets(id) ON DELETE CASCADE,
    FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE
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
  CREATE INDEX IF NOT EXISTS idx_folders_bucket ON folders(bucket_id);
  CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
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
    password_changed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE IF NOT EXISTS buckets (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(63) NOT NULL UNIQUE,
    is_public TINYINT(1) NOT NULL DEFAULT 0,
    quota_bytes BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE IF NOT EXISTS folders (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    bucket_id VARCHAR(36) NOT NULL,
    parent_id VARCHAR(36) NULL,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_folders_bucket (bucket_id),
    KEY idx_folders_parent (parent_id),
    CONSTRAINT fk_folders_bucket FOREIGN KEY (bucket_id) REFERENCES buckets(id) ON DELETE CASCADE,
    CONSTRAINT fk_folders_parent FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE IF NOT EXISTS files (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    bucket_id VARCHAR(36) NOT NULL,
    folder_id VARCHAR(36) NULL,
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(512) NOT NULL,
    mime_type VARCHAR(191) NOT NULL,
    size BIGINT NOT NULL,
    physical_path VARCHAR(1024) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_files_bucket (bucket_id),
    KEY idx_files_name (name),
    KEY idx_files_folder (folder_id),
    CONSTRAINT fk_files_bucket FOREIGN KEY (bucket_id) REFERENCES buckets(id) ON DELETE CASCADE,
    CONSTRAINT fk_files_folder FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
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

  // v3: per-bucket storage ceiling. NULL means "no limit", which is what every
  // bucket created before this column existed was implicitly using.
  if (!(await database.hasColumn('buckets', 'quota_bytes'))) {
    const columnType = database.dialect === 'mysql' ? 'BIGINT NULL' : 'INTEGER';
    await database.exec(`ALTER TABLE buckets ADD COLUMN quota_bytes ${columnType}`);
    console.log('MIGRATION: buckets.quota_bytes added; existing buckets stay unlimited.');
  }

  // v4: changing a password now invalidates that account's existing sessions.
  // Left NULL for current accounts so nobody is logged out by the upgrade itself.
  if (!(await database.hasColumn('users', 'password_changed_at'))) {
    const columnType = database.dialect === 'mysql' ? 'DATETIME NULL' : 'DATETIME';
    await database.exec(`ALTER TABLE users ADD COLUMN password_changed_at ${columnType}`);
    console.log('MIGRATION: users.password_changed_at added.');
  }

  // v6: folders inside buckets. Existing files stay at the bucket root, which is
  // what folder_id NULL means, so nothing moves and no listing changes shape.
  if (!(await database.hasColumn('files', 'folder_id'))) {
    const columnType = database.dialect === 'mysql' ? 'VARCHAR(36) NULL' : 'TEXT';
    await database.exec(`ALTER TABLE files ADD COLUMN folder_id ${columnType}`);
    console.log('MIGRATION: files.folder_id added; existing files stay at the bucket root.');
  }

  // Indexed here rather than in the schema above. On a database that already had
  // a files table, CREATE TABLE IF NOT EXISTS adds nothing, so the schema would
  // try to index a column that the migration has not added yet — which aborts
  // startup with "no such column: folder_id".
  try {
    await database.exec(
      database.dialect === 'mysql'
        ? 'CREATE INDEX idx_files_folder ON files (folder_id)'
        : 'CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id)'
    );
  } catch {
    // MySQL has no IF NOT EXISTS for indexes; a duplicate here is the normal
    // case on every restart after the first.
  }

  // v5: repair files stored before the extension fallback existed. Chrome on
  // Windows uploaded .heic/.avif/.opus as application/octet-stream, which left
  // them with a generic icon and no preview. Cheap to re-run: on an instance
  // with nothing to fix this is a single indexed-free scan returning no rows.
  const untyped = await database.all<{ id: string; original_name: string }[]>(
    `SELECT id, original_name FROM files WHERE mime_type = 'application/octet-stream'`
  );
  let repaired = 0;
  for (const row of untyped) {
    const guessed = mimeTypeFromFilename(row.original_name);
    if (!guessed) continue;
    await database.run('UPDATE files SET mime_type = ? WHERE id = ?', [guessed, row.id]);
    repaired += 1;
  }
  if (repaired > 0) {
    console.log(`MIGRATION: recovered the MIME type of ${repaired} file(s) from their extension.`);
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
