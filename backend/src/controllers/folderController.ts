import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../utils/db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getStorageProvider } from '../utils/storageProvider.js';
import {
  folderAndDescendants,
  findFolder,
  nameTaken,
  resolveTargetFolder,
  validateFolderName
} from '../utils/folders.js';

/** Every folder route works inside one bucket, looked up by name from the path. */
async function requireBucket(bucketName: string) {
  const bucket = await getDb().get('SELECT id, name FROM buckets WHERE name = ?', [bucketName]);
  return bucket as { id: string; name: string } | undefined;
}

export async function createFolder(req: AuthenticatedRequest, res: Response) {
  const { bucketName } = req.params;
  const { name, parentId } = req.body;

  const nameError = validateFolderName(name);
  if (nameError) {
    return res.status(400).json({ error: nameError });
  }

  try {
    const bucket = await requireBucket(bucketName);
    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found.' });
    }

    const parent = await resolveTargetFolder(parentId, bucket.id);
    const trimmed = (name as string).trim();

    if (await nameTaken(bucket.id, parent?.id ?? null, trimmed)) {
      return res.status(409).json({ error: `Sudah ada folder bernama '${trimmed}' di sini.` });
    }

    const id = uuidv4();
    await getDb().run(
      'INSERT INTO folders (id, bucket_id, parent_id, name) VALUES (?, ?, ?, ?)',
      [id, bucket.id, parent?.id ?? null, trimmed]
    );

    res.status(201).json({
      id,
      name: trimmed,
      parentId: parent?.id ?? null,
      fileCount: 0,
      subfolderCount: 0,
      message: `Folder '${trimmed}' dibuat.`
    });
  } catch (error) {
    // resolveTargetFolder throws for a folder outside this bucket.
    if (error instanceof Error && error.message.startsWith('Folder ')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function renameFolder(req: AuthenticatedRequest, res: Response) {
  const { bucketName, folderId } = req.params;
  const { name } = req.body;

  const nameError = validateFolderName(name);
  if (nameError) {
    return res.status(400).json({ error: nameError });
  }

  try {
    const bucket = await requireBucket(bucketName);
    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found.' });
    }

    const folder = await findFolder(folderId, bucket.id);
    if (!folder) {
      return res.status(404).json({ error: 'Folder tidak ditemukan.' });
    }

    const trimmed = (name as string).trim();
    if (await nameTaken(bucket.id, folder.parent_id, trimmed, folder.id)) {
      return res.status(409).json({ error: `Sudah ada folder bernama '${trimmed}' di sini.` });
    }

    await getDb().run('UPDATE folders SET name = ? WHERE id = ?', [trimmed, folder.id]);
    res.json({ id: folder.id, name: trimmed, message: 'Nama folder diperbarui.' });
  } catch (error) {
    console.error('Rename folder error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/**
 * Deletes a folder with everything under it.
 *
 * The objects are removed from the store first and the rows afterwards: a
 * database cascade alone would drop the metadata and leave the bytes behind,
 * silently consuming the bucket's quota with files nobody can see or delete.
 */
export async function deleteFolder(req: AuthenticatedRequest, res: Response) {
  const { bucketName, folderId } = req.params;

  try {
    const db = getDb();
    const bucket = await requireBucket(bucketName);
    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found.' });
    }

    const folder = await findFolder(folderId, bucket.id);
    if (!folder) {
      return res.status(404).json({ error: 'Folder tidak ditemukan.' });
    }

    const ids = await folderAndDescendants(folder.id, bucket.id);
    const placeholders = ids.map(() => '?').join(', ');
    const files = await db.all<{ id: string }[]>(
      `SELECT id FROM files WHERE folder_id IN (${placeholders})`,
      ids
    );

    const storage = getStorageProvider();
    for (const file of files) {
      await storage.deleteFile(bucket.id, file.id);
    }

    // Rows are removed explicitly rather than by cascade. A database that
    // existed before folders arrived never got the files->folders foreign key —
    // the migration can add a column but not a constraint — so relying on the
    // cascade there would leave file rows pointing at a folder that is gone.
    await db.run(`DELETE FROM files WHERE folder_id IN (${placeholders})`, ids);
    await db.run(`DELETE FROM folders WHERE id IN (${placeholders})`, ids);

    res.json({
      message: `Folder '${folder.name}' dihapus.`,
      deletedFolders: ids.length,
      deletedFiles: files.length
    });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/** Moves one file into a folder, or back to the bucket root with folderId null. */
export async function moveFile(req: AuthenticatedRequest, res: Response) {
  const { bucketName, fileId } = req.params;
  const { folderId } = req.body;

  try {
    const db = getDb();
    const bucket = await requireBucket(bucketName);
    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found.' });
    }

    const file = await db.get('SELECT id FROM files WHERE id = ? AND bucket_id = ?', [fileId, bucket.id]);
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const target = await resolveTargetFolder(folderId, bucket.id);
    // Metadata only: the object itself never moves, so this is instant even for
    // a multi-gigabyte video.
    await db.run('UPDATE files SET folder_id = ? WHERE id = ?', [target?.id ?? null, file.id]);

    res.json({
      id: file.id,
      folderId: target?.id ?? null,
      message: target ? `Berkas dipindahkan ke '${target.name}'.` : 'Berkas dipindahkan ke akar bucket.'
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Folder ')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Move file error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/** The folder tree of a bucket, flat, for a "move to..." picker. */
export async function listAllFolders(req: AuthenticatedRequest, res: Response) {
  const { bucketName } = req.params;

  try {
    const bucket = await requireBucket(bucketName);
    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found.' });
    }

    const rows = await getDb().all<{ id: string; parent_id: string | null; name: string }[]>(
      'SELECT id, parent_id, name FROM folders WHERE bucket_id = ? ORDER BY name ASC',
      [bucket.id]
    );

    // Emitted in tree order — each folder immediately followed by its children —
    // because the picker indents by depth, and a name-sorted flat list would put
    // a child under an unrelated sibling and make the indentation lie.
    const childrenOf = new Map<string | null, typeof rows>();
    for (const row of rows) {
      const siblings = childrenOf.get(row.parent_id) ?? [];
      siblings.push(row);
      childrenOf.set(row.parent_id, siblings);
    }

    const ordered: Array<{ id: string; name: string; parentId: string | null; depth: number }> = [];
    const walk = (parentId: string | null, depth: number) => {
      // Depth stop: a cycle should be impossible, but must not hang a request.
      if (depth > 64) return;
      for (const row of childrenOf.get(parentId) ?? []) {
        ordered.push({ id: row.id, name: row.name, parentId: row.parent_id, depth });
        walk(row.id, depth + 1);
      }
    };
    walk(null, 0);

    res.json(ordered);
  } catch (error) {
    console.error('List folders error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
