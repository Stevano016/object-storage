/**
 * One-off data import: copies every row from the SQLite database into MySQL.
 *
 *   DB_CLIENT=mysql node dist/scripts/migrate-to-mysql.js [--replace] [sqlite-file]
 *
 * The target must be empty unless --replace is given, so an accidental second
 * run can never silently merge two different datasets.
 */
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { createDatabase } from '../utils/database.js';
import { ensureSchema } from '../utils/db.js';
import { DB_CLIENT, SQLITE_FILE } from '../utils/config.js';

interface TableSpec {
  name: string;
  columns: string[];
  dateColumns: string[];
}

/** Parents first — foreign keys must resolve as rows land. */
const TABLES: TableSpec[] = [
  { name: 'users', columns: ['id', 'username', 'password_hash', 'role', 'created_at'], dateColumns: ['created_at'] },
  { name: 'buckets', columns: ['id', 'name', 'is_public', 'created_at'], dateColumns: ['created_at'] },
  {
    name: 'files',
    columns: ['id', 'bucket_id', 'name', 'original_name', 'mime_type', 'size', 'physical_path', 'created_at'],
    dateColumns: ['created_at']
  },
  {
    name: 'shares',
    columns: ['id', 'token', 'bucket_id', 'file_id', 'permission', 'label', 'expires_at', 'created_at'],
    dateColumns: ['expires_at', 'created_at']
  },
  { name: 'api_keys', columns: ['id', 'name', 'key_hash', 'created_at'], dateColumns: ['created_at'] }
];

/** Column defaults for rows written before a column existed. */
const DEFAULTS: Record<string, unknown> = {
  role: 'user',
  permission: 'viewer',
  is_public: 0
};

/**
 * SQLite writes CURRENT_TIMESTAMP as "YYYY-MM-DD HH:MM:SS" in UTC, while the
 * application wrote expiry dates as ISO-8601. Both must land in MySQL as the
 * same instant.
 */
function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;

  const raw = String(value);
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    console.warn(`  ! nilai tanggal tidak dikenali, dikosongkan: ${raw}`);
    return null;
  }
  return parsed;
}

async function main() {
  const args = process.argv.slice(2);
  const replace = args.includes('--replace');
  const sqliteFile = args.find(arg => !arg.startsWith('--')) || SQLITE_FILE;

  if (DB_CLIENT !== 'mysql') {
    console.error(`DB_CLIENT is "${DB_CLIENT}". Set DB_CLIENT=mysql before running the import.`);
    process.exit(1);
  }

  if (!fs.existsSync(sqliteFile)) {
    console.error(`SQLite file not found: ${sqliteFile}`);
    process.exit(1);
  }

  console.log(`Sumber : ${sqliteFile}`);
  const source = await open({ filename: sqliteFile, driver: sqlite3.Database });
  const target = await createDatabase();
  await ensureSchema(target);

  // Refuse to merge into a database that already holds data.
  const existing: Record<string, number> = {};
  for (const table of TABLES) {
    const row = await target.get<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table.name}`);
    existing[table.name] = Number(row?.count || 0);
  }
  const occupied = Object.entries(existing).filter(([, count]) => count > 0);

  if (occupied.length > 0 && !replace) {
    console.error('\nDatabase tujuan sudah berisi data:');
    occupied.forEach(([table, count]) => console.error(`  ${table}: ${count} baris`));
    console.error('\nJalankan ulang dengan --replace bila memang ingin menimpanya.');
    process.exit(1);
  }

  if (replace && occupied.length > 0) {
    console.log('\nMengosongkan tabel tujuan...');
    for (const table of [...TABLES].reverse()) {
      await target.run(`DELETE FROM ${table.name}`);
    }
  }

  console.log('\nMenyalin data:');
  const summary: Array<[string, number]> = [];

  for (const table of TABLES) {
    const rows = await source.all(`SELECT * FROM ${table.name}`);

    for (const row of rows) {
      const values = table.columns.map(column => {
        const value = column in row ? row[column] : DEFAULTS[column] ?? null;
        return table.dateColumns.includes(column) ? toDate(value) : value;
      });

      const placeholders = table.columns.map(() => '?').join(', ');
      await target.run(
        `INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES (${placeholders})`,
        values
      );
    }

    summary.push([table.name, rows.length]);
    console.log(`  ${table.name.padEnd(10)} ${rows.length} baris`);
  }

  console.log('\nVerifikasi jumlah baris di MySQL:');
  let mismatch = false;
  for (const [table, expected] of summary) {
    const row = await target.get<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);
    const actual = Number(row?.count || 0);
    const status = actual === expected ? 'OK' : 'BEDA';
    if (actual !== expected) mismatch = true;
    console.log(`  ${table.padEnd(10)} sumber=${expected} tujuan=${actual} ${status}`);
  }

  await source.close();
  await target.close();

  if (mismatch) {
    console.error('\nMigrasi selesai dengan selisih jumlah baris. Periksa log di atas.');
    process.exit(1);
  }

  console.log('\nMigrasi selesai. Semua baris cocok.');
}

main().catch(error => {
  console.error('Migrasi gagal:', error);
  process.exit(1);
});
