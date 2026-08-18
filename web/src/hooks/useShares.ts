import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { ShareLink, SharePermission } from '../types';

export interface CreateSharePayload {
  bucketName: string;
  permission: SharePermission;
  label?: string;
  /** Omit for a link that never expires. */
  expiresInDays?: number;
  /** Set to share a single file instead of the whole bucket. */
  fileId?: string;
}

/**
 * Deliberately does not fetch on mount: the file browser uses `createShare`
 * alone and must not pull the whole link list just to mint one link.
 * Pages that show the list call `refresh` themselves.
 */
export function useShares() {
  const { apiFetch } = useAuth();
  const { showToast } = useToast();
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setShares(await apiFetch<ShareLink[]>('/api/shares'));
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, showToast]);

  const createShare = useCallback(async (payload: CreateSharePayload): Promise<ShareLink | null> => {
    try {
      const created = await apiFetch<ShareLink>('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Tautan berbagi berhasil dibuat.');
      return created;
    } catch (error) {
      showToast((error as Error).message, 'error');
      return null;
    }
  }, [apiFetch, showToast]);

  const updateShare = useCallback(async (
    id: string,
    changes: { permission?: SharePermission; label?: string }
  ): Promise<boolean> => {
    try {
      await apiFetch(`/api/shares/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes)
      });
      showToast('Tautan berbagi diperbarui.');
      await refresh();
      return true;
    } catch (error) {
      showToast((error as Error).message, 'error');
      return false;
    }
  }, [apiFetch, showToast, refresh]);

  const revokeShare = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/shares/${id}`, { method: 'DELETE' });
      showToast('Tautan berbagi telah dicabut.');
      await refresh();
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }, [apiFetch, showToast, refresh]);

  return { shares, loading, refresh, createShare, updateShare, revokeShare };
}
