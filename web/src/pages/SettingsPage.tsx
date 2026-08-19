import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { FieldError } from '../components/ui/FieldError';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Spinner } from '../components/ui/Spinner';
import * as validate from '../lib/validation';
import { RoleBadge } from '../components/ui/RoleBadge';

export function SettingsPage() {
  const { apiFetch, user, login } = useAuth();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const found = {
      current: validate.requiredText(currentPassword, 'Password saat ini'),
      next: validate.password(newPassword, user?.username),
      confirm: validate.passwordConfirmation(confirmPassword, newPassword)
    };
    setErrors(found);
    if (!validate.isClean(found)) return;

    setLoading(true);
    try {
      // Changing the password revokes every token issued before it, this tab's
      // included, so the reply carries a replacement to swap in.
      const result = await apiFetch<{ token?: string }>('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (result?.token && user) {
        login(result.token, user);
      }

      showToast('Password berhasil diubah. Sesi lain telah dikeluarkan.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
        <h3>Akun Anda</h3>
        <div className="file-details-list" style={{ marginTop: '1rem' }}>
          <div className="detail-item">
            <span className="detail-label">Username</span>
            <span className="detail-value">{user?.username}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Peran</span>
            <span className="detail-value">{user && <RoleBadge role={user.role} />}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <KeyRound style={{ color: 'var(--accent-primary)' }} />
          <h3>Ganti Password</h3>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="curr-password">Password Saat Ini</label>
            <PasswordInput
              id="curr-password"
              placeholder="••••••••••••"
              value={currentPassword}
              onChange={value => { setCurrentPassword(value); setErrors(e => ({ ...e, current: null })); }}
              autoComplete="current-password"
              invalid={Boolean(errors.current)}
            />
            <FieldError message={errors.current} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="new-password">Password Baru</label>
            <PasswordInput
              id="new-password"
              placeholder={`Minimal ${validate.MIN_PASSWORD_LENGTH} karakter`}
              value={newPassword}
              onChange={value => { setNewPassword(value); setErrors(e => ({ ...e, next: null })); }}
              autoComplete="new-password"
              invalid={Boolean(errors.next)}
            />
            <FieldError message={errors.next} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="conf-password">Konfirmasi Password Baru</label>
            <PasswordInput
              id="conf-password"
              placeholder="Ulangi password baru"
              value={confirmPassword}
              onChange={value => { setConfirmPassword(value); setErrors(e => ({ ...e, confirm: null })); }}
              autoComplete="new-password"
              invalid={Boolean(errors.confirm)}
            />
            <FieldError message={errors.confirm} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? <Spinner size={18} /> : 'Perbarui Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
