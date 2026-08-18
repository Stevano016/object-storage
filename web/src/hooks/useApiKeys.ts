import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { ApiKey } from '../types';

export function useApiKeys() {
  const { apiFetch } = useAuth();
  const { showToast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setApiKeys(await apiFetch<ApiKey[]>('/api/keys'));
    } catch {
      showToast('Gagal memuat API Key.', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, showToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** The raw key is returned exactly once and never stored in plaintext. */
  const createApiKey = useCallback(async (name: string): Promise<string | null> => {
    try {
      const data = await apiFetch<{ apiKey: string }>('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      showToast('API Key baru berhasil dibuat.');
      await refresh();
      return data.apiKey;
    } catch (error) {
      showToast((error as Error).message, 'error');
      return null;
    }
  }, [apiFetch, showToast, refresh]);

  const deleteApiKey = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/keys/${id}`, { method: 'DELETE' });
      showToast('API Key berhasil direvoke.');
      await refresh();
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }, [apiFetch, showToast, refresh]);

  return { apiKeys, loading, refresh, createApiKey, deleteApiKey };
}
