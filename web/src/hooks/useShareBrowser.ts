import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { resolveApiUrl } from '../lib/apiUrl';
import { summarize, useUploads } from './useUploads';
import type { FileItem, FolderCrumb, FolderItem, Pagination, ShareInfo } from '../types';

const PAGE_SIZE = 24;

interface FileListResponse {
  files: FileItem[];
  folders: FolderItem[];
  path: FolderCrumb[];
  pagination: Pagination;
}

async function shareFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Permintaan gagal (HTTP ${response.status}).`);
  }

  return response.json() as Promise<T>;
}

/**
 * Drives the anonymous share page. Every request carries the link token in the
 * URL and no session at all, so this deliberately bypasses AuthContext.
 */
export function useShareBrowser(token: string) {
  const apiUrl = useMemo(resolveApiUrl, []);
  const { showToast } = useToast();
  const base = `${apiUrl}/api/share/${token}`;

  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [invalidReason, setInvalidReason] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [path, setPath] = useState<FolderCrumb[]>([]);
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
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
        search: targetSearch
      });
      if (targetFolderId) query.set('folderId', targetFolderId);

      const data = await shareFetch<FileListResponse>(`${base}/files?${query}`);
      setFiles(data.files);
      setFolders(data.folders ?? []);
      setPath(data.path ?? []);
      setFolderId(targetFolderId);
      setPage(data.pagination.page);
      setTotalPages(data.pagination.pages);
    } catch (error) {
      showToast((error as Error).message, 'error');
      if (targetFolderId) {
        setFolderId(null);
        setPath([]);
      }
    } finally {
      setLoading(false);
    }
  }, [base, showToast, folderId]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setInitializing(true);
      try {
        const data = await shareFetch<ShareInfo>(base);
        if (cancelled) return;
        setInfo(data);
        setInvalidReason(null);
        await load(1, '', null);
      } catch (error) {
        if (!cancelled) setInvalidReason((error as Error).message);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    };

    void init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  const openFolder = useCallback((targetFolderId: string | null) => {
    setSearch('');
    void load(1, '', targetFolderId);
  }, [load]);

  /** Same batching as the dashboard, minus the session headers a share link has none of. */
  const uploadFiles = useCallback(async (files: File[], onAllDone?: () => void) => {
    const summary = await startUploads(files, {
      url: `${base}/files`,
      fields: folderId ? { folderId } : {}
    });

    showToast(summarize(summary), summary.failed > 0 ? 'error' : 'success');

    if (summary.succeeded > 0) await load(1, search, folderId);
    if (summary.failed === 0) onAllDone?.();
  }, [base, showToast, load, search, startUploads, folderId]);

  const deleteFile = useCallback(async (fileId: string): Promise<boolean> => {
    try {
      await shareFetch(`${base}/files/${fileId}`, { method: 'DELETE' });
      showToast('Berkas berhasil dihapus.');
      await load(page, search, folderId);
      return true;
    } catch (error) {
      showToast((error as Error).message, 'error');
      return false;
    }
  }, [base, showToast, load, page, search, folderId]);

  const createFolder = useCallback(async (name: string): Promise<boolean> => {
    try {
      await shareFetch(`${base}/folders`, {
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
  }, [base, folderId, showToast, load]);

  const renameFolder = useCallback(async (folder: FolderItem, name: string): Promise<boolean> => {
    try {
      await shareFetch(`${base}/folders/${folder.id}`, {
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
  }, [base, folderId, page, search, showToast, load]);

  const deleteFolder = useCallback(async (folder: FolderItem): Promise<boolean> => {
    try {
      const result = await shareFetch<{ deletedFiles: number; deletedFolders: number }>(
        `${base}/folders/${folder.id}`,
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
  }, [base, folderId, showToast, load]);

  return {
    apiUrl,
    info,
    invalidReason,
    initializing,
    files,
    folders,
    path,
    folderId,
    openFolder,
    createFolder,
    renameFolder,
    deleteFolder,
    loading,
    page,
    totalPages,
    search,
    setSearch,
    load,
    uploading,
    uploads,
    uploadFiles,
    resetUploads,
    deleteFile
  };
}
