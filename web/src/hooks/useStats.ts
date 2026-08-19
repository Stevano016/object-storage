import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Stats } from '../types';

const EMPTY_STATS: Stats = {
  buckets: 0,
  files: 0,
  totalSize: 0,
  physicalDiskSize: 0,
  apiKeys: 0,
  users: 0,
  disk: null,
  diskLabel: '',
  storageProvider: 'local',
  accountsUsingDefaultPassword: []
};

export function useStats() {
  const { apiFetch } = useAuth();
  const { showToast } = useToast();
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  const refresh = useCallback(async () => {
    try {
      setStats(await apiFetch<Stats>('/api/auth/stats'));
    } catch {
      showToast('Gagal memuat statistik server.', 'error');
    }
  }, [apiFetch, showToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stats, refresh };
}
