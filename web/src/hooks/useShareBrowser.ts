import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { resolveApiUrl } from '../lib/apiUrl';
import { summarize, useUploads } from './useUploads';
import type { FileItem, Pagination, ShareInfo } from '../types';

const PAGE_SIZE = 24;

interface FileListResponse {
  files: FileItem[];
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
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  const { items: uploads, busy: uploading, start: startUploads, reset: resetUploads } = useUploads();

  const load = useCallback(async (targetPage = 1, targetSearch = '') => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
        search: targetSearch
      });
      const data = await shareFetch<FileListResponse>(`${base}/files?${query}`);
      setFiles(data.files);
      setPage(data.pagination.page);
      setTotalPages(data.pagination.pages);
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [base, showToast]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setInitializing(true);
      try {
        const data = await shareFetch<ShareInfo>(base);
        if (cancelled) return;
        setInfo(data);
        setInvalidReason(null);
        await load(1, '');
      } catch (error) {
        if (!cancelled) setInvalidReason((error as Error).message);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    };

    void init();
    return () => { cancelled = true; };
  }, [base, load]);

  /** Same batching as the dashboard, minus the session headers a share link has none of. */
  const uploadFiles = useCallback(async (files: File[], onAllDone?: () => void) => {
    const summary = await startUploads(files, { url: `${base}/files` });

    showToast(summarize(summary), summary.failed > 0 ? 'error' : 'success');

    if (summary.succeeded > 0) await load(1, search);
    if (summary.failed === 0) onAllDone?.();
  }, [base, showToast, load, search, startUploads]);

  const deleteFile = useCallback(async (fileId: string): Promise<boolean> => {
    try {
      await shareFetch(`${base}/files/${fileId}`, { method: 'DELETE' });
      showToast('Berkas berhasil dihapus.');
      await load(page, search);
      return true;
    } catch (error) {
      showToast((error as Error).message, 'error');
      return false;
    }
  }, [base, showToast, load, page, search]);

  return {
    apiUrl,
    info,
    invalidReason,
    initializing,
    files,
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
