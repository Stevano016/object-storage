import { useState } from 'react';
import { FieldError } from '../ui/FieldError';
import { Modal } from '../ui/Modal';
import { PasswordInput } from '../ui/PasswordInput';
import { Spinner } from '../ui/Spinner';
import * as validate from '../../lib/validation';
import type { UserPayload } from '../../hooks/useUsers';
import type { ManagedUser, UserRole } from '../../types';

interface UserFormModalProps {
  /** Omitted when creating a new account. */
  user?: ManagedUser;
  /** A superadmin may not change their own role, so the field is locked. */
  isSelf: boolean;
  onSubmit: (payload: UserPayload) => Promise<boolean>;
  onClose: () => void;
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string; hint: string }> = [
  { value: 'user', label: 'User Biasa', hint: 'Hanya dapat melihat dan mengunggah berkas.' },
  { value: 'superadmin', label: 'Super Admin', hint: 'Akses penuh: bucket, API key, dan manajemen pengguna.' }
];

export function UserFormModal({ user, isSelf, onSubmit, onClose }: UserFormModalProps) {
  const isEditing = Boolean(user);

  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'user');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ username?: string | null; password?: string | null }>({});

  const selectedRoleHint = ROLE_OPTIONS.find(option => option.value === role)?.hint;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // When editing, an empty password means "leave it alone" — so it is only
    // checked when something was actually typed.
    const found = {
      username: validate.username(username),
      password: isEditing && !password ? null : validate.password(password, username)
    };
    setErrors(found);
    if (!validate.isClean(found)) return;

    const payload: UserPayload = { username: username.trim() };
    if (password) payload.password = password;
    if (!isSelf) payload.role = role;

    setSaving(true);
    const succeeded = await onSubmit(payload);
    setSaving(false);

    if (succeeded) onClose();
  };

  return (
    <Modal
      title={isEditing ? `Ubah Pengguna: ${user?.username}` : 'Tambah Pengguna Baru'}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? <Spinner size={18} /> : isEditing ? 'Simpan Perubahan' : 'Buat Pengguna'}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label" htmlFor="user-username">Username</label>
        <input
          className={`form-input${errors.username ? ' has-error' : ''}`}
          id="user-username"
          type="text"
          placeholder="operator-gudang"
          value={username}
          onChange={event => { setUsername(event.target.value); setErrors(e => ({ ...e, username: null })); }}
          aria-invalid={errors.username ? true : undefined}
          autoComplete="off"
        />
        {errors.username
          ? <FieldError message={errors.username} />
          : (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              3-32 karakter: huruf, angka, titik, garis bawah, atau tanda hubung.
            </p>
          )}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="user-password">
          {isEditing ? 'Password Baru (opsional)' : 'Password'}
        </label>
        <PasswordInput
          id="user-password"
          placeholder={isEditing ? 'Kosongkan bila tidak ingin mengubah' : `Minimal ${validate.MIN_PASSWORD_LENGTH} karakter`}
          value={password}
          onChange={value => { setPassword(value); setErrors(e => ({ ...e, password: null })); }}
          autoComplete="new-password"
          invalid={Boolean(errors.password)}
        />
        <FieldError message={errors.password} />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="user-role">Peran</label>
        <select
          className="form-input"
          id="user-role"
          value={role}
          onChange={event => setRole(event.target.value as UserRole)}
          disabled={isSelf}
          style={{ cursor: isSelf ? 'not-allowed' : 'pointer' }}
        >
          {ROLE_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          {isSelf ? 'Anda tidak dapat mengubah peran akun Anda sendiri.' : selectedRoleHint}
        </p>
      </div>
    </Modal>
  );
}
