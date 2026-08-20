import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { FieldError } from '../components/ui/FieldError';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Spinner } from '../components/ui/Spinner';
import { requiredText } from '../lib/validation';
import { Toaster } from '../components/ui/Toaster';
import type { AuthUser } from '../types';

export function LoginPage() {
  const { apiUrl, login } = useAuth();
  const { showToast } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string | null; password?: string | null }>({});

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Only presence is checked here. The strength rules belong on the forms that
    // set a password — applying them at sign-in would lock out an older account
    // whose password predates the current policy.
    const found = {
      username: requiredText(username, 'Username'),
      password: requiredText(password, 'Password')
    };
    setErrors(found);
    if (found.username || found.password) return;

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json() as { token: string; user: AuthUser; error?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Login gagal.');
      }

      login(data.token, data.user);
      showToast('Login berhasil. Selamat datang.');
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.png" alt="Logo" style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: '0.5rem' }} />
          <h1>Gentan Storage</h1>
          <p>Self-Hosted Secure Object Storage Server</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">Username</label>
            <input
              className={`form-input${errors.username ? ' has-error' : ''}`}
              id="login-username"
              type="text"
              placeholder="admin"
              value={username}
              onChange={event => { setUsername(event.target.value); setErrors(e => ({ ...e, username: null })); }}
              aria-invalid={errors.username ? true : undefined}
              autoComplete="username"
            />
            <FieldError message={errors.username} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <PasswordInput
              id="login-password"
              placeholder="••••••••••••"
              value={password}
              onChange={value => { setPassword(value); setErrors(e => ({ ...e, password: null })); }}
              autoComplete="current-password"
              invalid={Boolean(errors.password)}
            />
            <FieldError message={errors.password} />
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1.5rem' }}
            type="submit"
            disabled={loading}
          >
            {loading ? <Spinner size={18} /> : 'Masuk ke Dashboard'}
          </button>
        </form>
      </div>

      <Toaster />
    </div>
  );
}
