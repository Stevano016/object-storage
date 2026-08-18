import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export type UserRole = 'superadmin' | 'user';

export const BCRYPT_ROUNDS = 10;

let db: Database<sqlite3.Database, sqlite3.Statement>;

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  return bcrypt.hash(plain, salt);
}

async function runMigrations(database: Database<sqlite3.Database, sqlite3.Statement>) {
  // v2: role-based access control. Older databases only had a single admin account.
  const userColumns = await database.all('PRAGMA table_info(users)');
  const hasRole = userColumns.some((column: { name: string }) => column.name === 'role');

  if (!hasRole) {
    await database.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
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

async function seedDefaultSuperadmin(database: Database<sqlite3.Database, sqlite3.Statement>) {
  const anyUser = await database.get('SELECT id FROM users LIMIT 1');
  if (anyUser) return;

  const defaultUsername = 'admin';
  const defaultPassword = 'admingentan123'; // Simple, clear default password for initial VPS deployment

  await database.run(
    'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
    [uuidv4(), defaultUsername, await hashPassword(defaultPassword), 'superadmin']
  );

  console.log('==================================================');
  console.log('SEED: Default superadmin user created!');
  console.log(`Username: ${defaultUsername}`);
  console.log(`Password: ${defaultPassword}`);
  console.log('PLEASE CHANGE THIS PASSWORD ON YOUR FIRST LOGIN.');
  console.log('==================================================');
}

export async function initDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  const dataDir = path.resolve('data');
  const storageDir = path.join(dataDir, 'storage');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  db = await open({
    filename: path.join(dataDir, 'database.sqlite'),
    driver: sqlite3.Database
  });

  // Enable foreign keys for referential integrity
  await db.run('PRAGMA foreign_keys = ON;');

  // Create tables if they don't exist
  await db.exec(`
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

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes for query performance optimization
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_files_bucket ON files(bucket_id);
    CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
  `);

  await runMigrations(db);
  await seedDefaultSuperadmin(db);

  return db;
}

export function getDb(): Database<sqlite3.Database, sqlite3.Statement> {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}
