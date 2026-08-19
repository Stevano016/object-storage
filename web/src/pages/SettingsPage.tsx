import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Spinner } from '../components/ui/Spinner';
import { RoleBadge } from '../components/ui/RoleBadge';

/** Kept in step with MIN_PASSWORD_LENGTH on the server. */
const MIN_PASSWORD_LENGTH = 10;

export function SettingsPage() {
  const { apiFetch, user, login } = useAuth();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      showToast('Password baru dan konfirmasi tidak cocok.', 'error');
      return;
    }

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

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="curr-password">Password Saat Ini</label>
            <PasswordInput
              id="curr-password"
              placeholder="••••••••••••"
              value={currentPassword}
              onChange={setCurrentPassword}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="new-password">Password Baru</label>
            <PasswordInput
              id="new-password"
              placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
              value={newPassword}
              onChange={setNewPassword}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="conf-password">Konfirmasi Password Baru</label>
            <PasswordInput
              id="conf-password"
              placeholder="Ulangi password baru"
              value={confirmPassword}
              onChange={setConfirmPassword}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? <Spinner size={18} /> : 'Perbarui Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
