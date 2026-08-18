import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { uploadWithProgress } from '../lib/upload';
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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

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

  const uploadFile = useCallback(async (file: File, onComplete?: () => void) => {
    if (!bucketName) {
      showToast('Pilih bucket terlebih dahulu.', 'error');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      await uploadWithProgress({
        url: `${apiUrl}/api/buckets/${bucketName}/files`,
        file,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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
  }, [bucketName, apiUrl, token, showToast, load, search]);

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
    uploadProgress,
    uploadFile,
    deleteFile
  };
}
