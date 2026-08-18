import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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

  /**
   * Uploads through XMLHttpRequest rather than fetch, because only XHR reports
   * upload progress — important for the large media files this server targets.
   */
  const uploadFile = useCallback((file: File, onComplete?: () => void) => {
    if (!bucketName) {
      showToast('Pilih bucket terlebih dahulu.', 'error');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', `${apiUrl}/api/buckets/${bucketName}/files`);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = event => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      setUploading(false);
      setUploadProgress(null);

      if (xhr.status >= 200 && xhr.status < 300) {
        showToast(`Berkas '${file.name}' berhasil diunggah.`);
        void load(1, search);
        onComplete?.();
        return;
      }

      let message = 'Gagal mengunggah berkas.';
      try {
        message = JSON.parse(xhr.responseText).error || message;
      } catch {
        // Non-JSON error body (e.g. a proxy timeout page): keep the default text.
      }
      showToast(message, 'error');
    };

    xhr.onerror = () => {
      setUploading(false);
      setUploadProgress(null);
      showToast('Jaringan bermasalah saat mengunggah.', 'error');
    };

    xhr.send(formData);
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
