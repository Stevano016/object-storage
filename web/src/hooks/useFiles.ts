import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { summarize, useUploads } from './useUploads';
import type { FileItem, Pagination } from '../types';

const PAGE_SIZE = 24;

interface FileListResponse {
  files: FileItem[];
  pagination: Pagination;
}

export function useFiles(bucketName: string) {
  const { apiFetch, apiUrl, token } = useAuth();
  const { showToast } = useToast();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const { items: uploads, busy: uploading, start: startUploads, reset: resetUploads } = useUploads();

  const load = useCallback(async (targetPage = 1, targetSearch = '') => {
    if (!bucketName) {
      setFiles([]);
      return;
    }

    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
        search: targetSearch
      });
      const data = await apiFetch<FileListResponse>(`/api/buckets/${bucketName}/files?${query}`);
      setFiles(data.files);
      setPage(data.pagination.page);
      setTotalPages(data.pagination.pages);
    } catch {
      showToast('Gagal memuat berkas.', 'error');
    } finally {
      setLoading(false);
    }
  }, [bucketName, apiFetch, showToast]);

  // Reset to the first page whenever the selected bucket changes.
  useEffect(() => {
    setSearch('');
    void load(1, '');
  }, [load]);

  const reload = useCallback(() => load(page, search), [load, page, search]);

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
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    showToast(summarize(summary), summary.failed > 0 ? 'error' : 'success');

    // Reloaded once for the whole batch rather than per file.
    if (summary.succeeded > 0) await load(1, search);
    if (summary.failed === 0) onAllDone?.();
  }, [bucketName, apiUrl, token, showToast, load, search, startUploads]);

  const deleteFile = useCallback(async (fileId: string): Promise<boolean> => {
    try {
      await apiFetch(`/api/buckets/${bucketName}/files/${fileId}`, { method: 'DELETE' });
      showToast('Berkas berhasil dihapus.');
      await load(page, search);
      return true;
    } catch (error) {
      showToast((error as Error).message, 'error');
      return false;
    }
  }, [apiFetch, bucketName, showToast, load, page, search]);

  return {
    files,
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
