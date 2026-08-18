import { useState } from 'react';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { UserFormModal } from '../components/users/UserFormModal';
import { EmptyState } from '../components/ui/EmptyState';
import { RoleBadge } from '../components/ui/RoleBadge';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { useUsers } from '../hooks/useUsers';
import type { UserPayload } from '../hooks/useUsers';
import { formatDate } from '../lib/format';
import type { ManagedUser, UserRole } from '../types';

type FormState =
  | { mode: 'create' }
  | { mode: 'edit'; user: ManagedUser }
  | null;

interface UsersPageProps {
  onUsersChanged: () => void;
}

export function UsersPage({ onUsersChanged }: UsersPageProps) {
  const { user: currentUser, refreshUser } = useAuth();
  const { users, loading, createUser, updateUser, deleteUser } = useUsers();
  const [form, setForm] = useState<FormState>(null);

  const handleSubmit = async (payload: UserPayload): Promise<boolean> => {
    if (!form) return false;

    const succeeded = form.mode === 'create'
      ? await createUser({
          username: payload.username ?? '',
          password: payload.password ?? '',
          role: (payload.role ?? 'user') as UserRole
        })
      : await updateUser(form.user.id, payload);

    if (succeeded) {
      onUsersChanged();
      // Editing your own account may rename it, so refresh the session profile.
      if (form.mode === 'edit' && form.user.id === currentUser?.id) {
        await refreshUser();
      }
    }

    return succeeded;
  };

  const handleDelete = async (target: ManagedUser) => {
    if (!window.confirm(`Hapus pengguna '${target.username}'? Tindakan ini tidak bisa dibatalkan.`)) return;
    await deleteUser(target);
    onUsersChanged();
  };

  return (
    <div>
      <div className="page-heading">
        <div>
          <h3>Manajemen Pengguna</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Super Admin dapat mengatur seluruh sistem. User Biasa hanya dapat melihat dan mengunggah berkas.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm({ mode: 'create' })}>
          <Plus style={{ width: 18, height: 18 }} />
          Tambah Pengguna
        </button>
      </div>

      {loading ? (
        <Spinner block />
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada pengguna"
          description="Tambahkan akun untuk anggota tim yang perlu mengunggah berkas."
        />
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Peran</th>
                <th>Tanggal Dibuat</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map(item => {
                const isSelf = item.id === currentUser?.id;

                return (
                  <tr key={item.id}>
                    <td data-label="Username" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.username}
                      {isSelf && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                          (Anda)
                        </span>
                      )}
                    </td>
                    <td data-label="Peran"><RoleBadge role={item.role} /></td>
                    <td data-label="Dibuat">{formatDate(item.createdAt)}</td>
                    <td data-label="Aksi" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-icon-only"
                          onClick={() => setForm({ mode: 'edit', user: item })}
                          title="Ubah pengguna"
                        >
                          <Pencil style={{ width: 16, height: 16 }} />
                        </button>
                        <button
                          className="btn btn-danger btn-icon-only"
                          onClick={() => void handleDelete(item)}
                          title={isSelf ? 'Akun sendiri tidak dapat dihapus' : 'Hapus pengguna'}
                          disabled={isSelf}
                        >
                          <Trash2 style={{ width: 16, height: 16 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <UserFormModal
          user={form.mode === 'edit' ? form.user : undefined}
          isSelf={form.mode === 'edit' && form.user.id === currentUser?.id}
          onSubmit={handleSubmit}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
