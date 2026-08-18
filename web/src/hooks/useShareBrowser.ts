import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { resolveApiUrl } from '../lib/apiUrl';
import { checkProxyUploadLimit, uploadWithProgress } from '../lib/upload';
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

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

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

  const uploadFile = useCallback(async (file: File, onComplete?: () => void) => {
    const limitError = checkProxyUploadLimit(file);
    if (limitError) {
      showToast(limitError, 'error');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      await uploadWithProgress({
        url: `${base}/files`,
        file,
        onProgress: setUploadProgress
      });
      showToast(`Berkas '${file.name}' berhasil diunggah.`);
      await load(1, search);
      onComplete?.();
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [base, showToast, load, search]);

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
    uploadProgress,
    uploadFile,
    deleteFile
  };
}
