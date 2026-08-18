import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

let db: Database<sqlite3.Database, sqlite3.Statement>;

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

  // Seed default admin user if none exists
  const adminCheck = await db.get('SELECT * FROM users LIMIT 1');
  if (!adminCheck) {
    const defaultUsername = 'admin';
    const defaultPassword = 'admingentan123'; // Simple, clear default password for initial VPS deployment
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);
    const adminId = uuidv4();

    await db.run(
      'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
      [adminId, defaultUsername, passwordHash]
    );

    console.log('==================================================');
    console.log('SEED: Default admin user created!');
    console.log(`Username: ${defaultUsername}`);
    console.log(`Password: ${defaultPassword}`);
    console.log('PLEASE CHANGE THIS PASSWORD ON YOUR FIRST LOGIN.');
    console.log('==================================================');
  }

  return db;
}

export function getDb(): Database<sqlite3.Database, sqlite3.Statement> {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}
