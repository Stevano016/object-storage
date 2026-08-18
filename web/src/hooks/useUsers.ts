import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { ManagedUser, UserRole } from '../types';

export interface UserPayload {
  username?: string;
  password?: string;
  role?: UserRole;
}

export function useUsers() {
  const { apiFetch } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await apiFetch<ManagedUser[]>('/api/users'));
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, showToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createUser = useCallback(async (payload: Required<UserPayload>): Promise<boolean> => {
    try {
      await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast(`Pengguna '${payload.username}' berhasil dibuat.`);
      await refresh();
      return true;
    } catch (error) {
      showToast((error as Error).message, 'error');
      return false;
    }
  }, [apiFetch, showToast, refresh]);

  const updateUser = useCallback(async (id: string, payload: UserPayload): Promise<boolean> => {
    try {
      await apiFetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Data pengguna berhasil diperbarui.');
      await refresh();
      return true;
    } catch (error) {
      showToast((error as Error).message, 'error');
      return false;
    }
  }, [apiFetch, showToast, refresh]);

  const deleteUser = useCallback(async (user: ManagedUser) => {
    try {
      await apiFetch(`/api/users/${user.id}`, { method: 'DELETE' });
      showToast(`Pengguna '${user.username}' telah dihapus.`);
      await refresh();
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }, [apiFetch, showToast, refresh]);

  return { users, loading, refresh, createUser, updateUser, deleteUser };
}
