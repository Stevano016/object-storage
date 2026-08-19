import { useState } from 'react';
import { HardDrive } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Spinner } from '../components/ui/Spinner';
import { Toaster } from '../components/ui/Toaster';
import type { AuthUser } from '../types';

export function LoginPage() {
  const { apiUrl, login } = useAuth();
  const { showToast } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!username || !password) {
      showToast('Masukkan username dan password.', 'error');
      return;
    }

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
          <HardDrive />
          <h1>Gentan Storage</h1>
          <p>Self-Hosted Secure Object Storage Server</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">Username</label>
            <input
              className="form-input"
              id="login-username"
              type="text"
              placeholder="admin"
              value={username}
              onChange={event => setUsername(event.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <PasswordInput
              id="login-password"
              placeholder="••••••••••••"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
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
