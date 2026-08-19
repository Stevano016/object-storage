import { getDb } from './db.js';

export interface FolderRow {
  id: string;
  bucket_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
}

export interface FolderDto {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  /** Direct children only — what the browser shows as a badge on the card. */
  fileCount: number;
  subfolderCount: number;
}

/**
 * Folders are metadata, not directories.
 *
 * Objects stay flat in the store, one per file id, so renaming or moving a
 * folder is a single row update rather than copying gigabytes between prefixes.
 * The trade is that every listing has to filter on folder_id, which is indexed.
 */

/** Same character rules as a filename, minus anything that breaks a path display. */
const NAME_PATTERN = /^[^/\\:*?"<>|]{1,80}$/;

export function validateFolderName(name: unknown): string | null {
  if (typeof name !== 'string' || !name.trim()) {
    return 'Nama folder wajib diisi.';
  }
  const trimmed = name.trim();
  if (!NAME_PATTERN.test(trimmed)) {
    return 'Nama folder maksimal 80 karakter dan tidak boleh memuat / \\ : * ? " < > |';
  }
  if (trimmed === '.' || trimmed === '..') {
    return 'Nama folder itu tidak diizinkan.';
  }
  return null;
}

export async function findFolder(id: string, bucketId: string): Promise<FolderRow | undefined> {
  return getDb().get<FolderRow>(
    'SELECT * FROM folders WHERE id = ? AND bucket_id = ?',
    [id, bucketId]
  );
}

/** True when a sibling already uses this name, which would make the tree ambiguous. */
export async function nameTaken(
  bucketId: string,
  parentId: string | null,
  name: string,
  exceptId?: string
): Promise<boolean> {
  const filters = ['bucket_id = ?', 'name = ?'];
  const params: unknown[] = [bucketId, name];

  // NULL is not comparable with '=', and the two engines disagree about how
  // NULL behaves in a unique index — so the check lives here instead.
  filters.push(parentId === null ? 'parent_id IS NULL' : 'parent_id = ?');
  if (parentId !== null) params.push(parentId);

  if (exceptId) {
    filters.push('id != ?');
    params.push(exceptId);
  }

  const row = await getDb().get(
    `SELECT id FROM folders WHERE ${filters.join(' AND ')} LIMIT 1`,
    params
  );
  return Boolean(row);
}

/** Direct children of a folder (or of the bucket root when parentId is null). */
export async function listChildFolders(bucketId: string, parentId: string | null): Promise<FolderDto[]> {
  const db = getDb();
  const rows = await db.all<FolderRow[]>(
    `SELECT * FROM folders
     WHERE bucket_id = ? AND ${parentId === null ? 'parent_id IS NULL' : 'parent_id = ?'}
     ORDER BY name ASC`,
    parentId === null ? [bucketId] : [bucketId, parentId]
  );

  // Counted per folder rather than with one grouped query: the numbers are only
  // a hint on the card, and this keeps the SQL the same on both engines.
  return Promise.all(rows.map(async row => {
    const files = await db.get('SELECT COUNT(*) as count FROM files WHERE folder_id = ?', [row.id]);
    const subfolders = await db.get('SELECT COUNT(*) as count FROM folders WHERE parent_id = ?', [row.id]);
    return {
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      createdAt: row.created_at,
      fileCount: Number(files?.count || 0),
      subfolderCount: Number(subfolders?.count || 0)
    };
  }));
}

/**
 * The chain from the bucket root down to `folderId`, root first.
 *
 * Walks upward one row at a time with a depth stop: a parent cycle should be
 * impossible (moves reject them) but a corrupted row must not hang a request.
 */
export async function folderPath(folderId: string | null, bucketId: string): Promise<Array<{ id: string; name: string }>> {
  const path: Array<{ id: string; name: string }> = [];
  let current = folderId;

  for (let depth = 0; current && depth < 64; depth += 1) {
    const row = await findFolder(current, bucketId);
    if (!row) break;
    path.unshift({ id: row.id, name: row.name });
    current = row.parent_id;
  }

  return path;
}

/** A folder plus every folder beneath it, deepest last. */
export async function folderAndDescendants(folderId: string, bucketId: string): Promise<string[]> {
  const db = getDb();
  const collected = [folderId];

  for (let index = 0; index < collected.length; index += 1) {
    const children = await db.all<{ id: string }[]>(
      'SELECT id FROM folders WHERE bucket_id = ? AND parent_id = ?',
      [bucketId, collected[index]]
    );
    for (const child of children) {
      if (!collected.includes(child.id)) collected.push(child.id);
    }
  }

  return collected;
}

/**
 * Resolves the `folderId` a request asked for.
 *
 * Returns the row, or null for the bucket root. Throws when the folder does not
 * belong to this bucket — silently falling back to the root would let a caller
 * upload into a bucket they only guessed the folder id of.
 */
export async function resolveTargetFolder(
  folderId: unknown,
  bucketId: string
): Promise<FolderRow | null> {
  if (folderId === undefined || folderId === null || folderId === '' || folderId === 'root') {
    return null;
  }
  if (typeof folderId !== 'string') {
    throw new Error('Folder tidak valid.');
  }

  const row = await findFolder(folderId, bucketId);
  if (!row) {
    throw new Error('Folder tidak ditemukan di bucket ini.');
  }
  return row;
}
