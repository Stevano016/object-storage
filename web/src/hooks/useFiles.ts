import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { summarize, useUploads } from './useUploads';
import type { FileItem, FolderCrumb, FolderItem, Pagination } from '../types';

const PAGE_SIZE = 24;

interface FileListResponse {
  files: FileItem[];
  folders: FolderItem[];
  /** Bucket root excluded; empty means we are at the root. */
  path: FolderCrumb[];
  pagination: Pagination;
}

export function useFiles(bucketName: string) {
  const { apiFetch, apiUrl, token } = useAuth();
  const { showToast } = useToast();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [path, setPath] = useState<FolderCrumb[]>([]);
  // null is the bucket root. Kept in state rather than derived from `path` so a
  // failed listing cannot strand the browser in a folder that no longer exists.
  const [folderId, setFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const { items: uploads, busy: uploading, start: startUploads, reset: resetUploads } = useUploads();

  const load = useCallback(async (
    targetPage = 1,
    targetSearch = '',
    targetFolderId: string | null = folderId
  ) => {
    if (!bucketName) {
      setFiles([]);
      setFolders([]);
      setPath([]);
      return;
    }

    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
        search: targetSearch
      });
      if (targetFolderId) query.set('folderId', targetFolderId);

      const data = await apiFetch<FileListResponse>(`/api/buckets/${bucketName}/files?${query}`);
      setFiles(data.files);
      setFolders(data.folders ?? []);
      setPath(data.path ?? []);
      setFolderId(targetFolderId);
      setPage(data.pagination.page);
      setTotalPages(data.pagination.pages);
    } catch (error) {
      showToast((error as Error).message || 'Gagal memuat berkas.', 'error');
      // A folder that was deleted in another tab would otherwise keep failing.
      if (targetFolderId) {
        setFolderId(null);
        setPath([]);
      }
    } finally {
      setLoading(false);
    }
  }, [bucketName, apiFetch, showToast, folderId]);

  // Reset to the bucket root whenever the selected bucket changes.
  useEffect(() => {
    setSearch('');
    setFolderId(null);
    void load(1, '', null);
    // load() depends on folderId, which this effect also sets; including it here
    // would re-run the listing on every folder change and fight openFolder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucketName]);

  const reload = useCallback(() => load(page, search, folderId), [load, page, search, folderId]);

  /** Navigates into a folder, or back to the bucket root with null. */
  const openFolder = useCallback((targetFolderId: string | null) => {
    setSearch('');
    void load(1, '', targetFolderId);
  }, [load]);

  /**
   * Uploads a batch. `onAllDone` only fires when every file made it, so a batch
   * with a failure keeps the dialog open with the reasons still on screen.
   */
  const uploadFiles = useCallback(async (files: File[], onAllDone?: () => void) => {
    if (!bucketName) {
      showToast('Pilih bucket terlebih dahulu.', 'error');
      return;
    }

    const summary = await startUploads(files, {
      url: `${apiUrl}/api/buckets/${bucketName}/files`,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      // Uploads land wherever the browser currently is, which is what dragging
      // files onto an open folder is expected to mean.
      fields: folderId ? { folderId } : {}
    });

    showToast(summarize(summary), summary.failed > 0 ? 'error' : 'success');

    // Reloaded once for the whole batch rather than per file.
    if (summary.succeeded > 0) await load(1, search, folderId);
    if (summary.failed === 0) onAllDone?.();
  }, [bucketName, apiUrl, token, showToast, load, search, startUploads, folderId]);

  const deleteFile = useCallback(async (fileId: string): Promise<boolean> => {
    try {
      await apiFetch(`/api/buckets/${bucketName}/files/${fileId}`, { method: 'DELETE' });
      showToast('Berkas berhasil dihapus.');
      await load(page, search, folderId);
      return true;
    } catch (error) {
      showToast((error as Error).message, 'error');
      return false;
    }
  }, [apiFetch, bucketName, showToast, load, page, search, folderId]);

  const createFolder = useCallback(async (name: string): Promise<boolean> => {
    try {
      await apiFetch(`/api/buckets/${bucketName}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId: folderId })
      });
      showToast(`Folder '${name}' dibuat.`);
      await load(1, '', folderId);
      return true;
    } catch (error) {
      showToast((error as Error).message, 'error');
      return false;
    }
  }, [apiFetch, bucketName, folderId, showToast, load]);

  const renameFolder = useCallback(async (folder: FolderItem, name: string): Promise<boolean> => {
    try {
      await apiFetch(`/api/buckets/${bucketName}/folders/${folder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      showToast('Nama folder diperbarui.');
      await load(page, search, folderId);
      return true;
    } catch (error) {
      showToast((error as Error).message, 'error');
      return false;
    }
  }, [apiFetch, bucketName, folderId, page, search, showToast, load]);

  const deleteFolder = useCallback(async (folder: FolderItem): Promise<boolean> => {
    try {
      const result = await apiFetch<{ deletedFiles: number; deletedFolders: number }>(
        `/api/buckets/${bucketName}/folders/${folder.id}`,
        { method: 'DELETE' }
      );
      showToast(
        result.deletedFiles > 0
          ? `Folder '${folder.name}' dan ${result.deletedFiles} berkas di dalamnya dihapus.`
          : `Folder '${folder.name}' dihapus.`
      );
      await load(1, '', folderId);
      return true;
    } catch (error) {
      showToast((error as Error).message, 'error');
      return false;
    }
  }, [apiFetch, bucketName, folderId, showToast, load]);

  const moveFile = useCallback(async (
    fileId: string,
    targetFolderId: string | null
  ): Promise<boolean> => {
    try {
      const result = await apiFetch<{ message: string }>(
        `/api/buckets/${bucketName}/files/${fileId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId: targetFolderId })
        }
      );
      showToast(result.message);
      await load(page, search, folderId);
      return true;
    } catch (error) {
      showToast((error as Error).message, 'error');
      return false;
    }
  }, [apiFetch, bucketName, folderId, page, search, showToast, load]);

  return {
    files,
    folders,
    path,
    folderId,
    openFolder,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFile,
    loading,
    page,
    totalPages,
    search,
    setSearch,
    load,
    reload,
    uploading,
    uploads,
    uploadFiles,
    resetUploads,
    deleteFile
  };
}
