import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Bucket } from '../types';

export function useBuckets() {
  const { apiFetch } = useAuth();
  const { showToast } = useToast();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setBuckets(await apiFetch<Bucket[]>('/api/buckets'));
    } catch {
      showToast('Gagal memuat daftar bucket.', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, showToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createBucket = useCallback(async (name: string, isPublic: boolean): Promise<boolean> => {
    try {
      await apiFetch('/api/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, isPublic })
      });
      showToast(`Bucket '${name}' berhasil dibuat.`);
      await refresh();
      return true;
    } catch (error) {
      showToast((error as Error).message, 'error');
      return false;
    }
  }, [apiFetch, showToast, refresh]);

  const deleteBucket = useCallback(async (name: string): Promise<boolean> => {
    try {
      await apiFetch(`/api/buckets/${name}`, { method: 'DELETE' });
      showToast(`Bucket '${name}' telah dihapus.`);
      await refresh();
      return true;
    } catch (error) {
      showToast((error as Error).message, 'error');
      return false;
    }
  }, [apiFetch, showToast, refresh]);

  const setBucketVisibility = useCallback(async (bucket: Bucket, isPublic: boolean) => {
    try {
      await apiFetch(`/api/buckets/${bucket.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic })
      });
      showToast(`Akses bucket '${bucket.name}' diubah ke ${isPublic ? 'PUBLIK' : 'PRIVAT'}.`);
      await refresh();
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }, [apiFetch, showToast, refresh]);

  return { buckets, loading, refresh, createBucket, deleteBucket, setBucketVisibility };
}
