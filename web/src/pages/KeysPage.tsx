import { useState } from 'react';
import { CheckCircle, Copy, Trash2 } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { useApiKeys } from '../hooks/useApiKeys';
import { useClipboard } from '../hooks/useClipboard';
import { formatDate } from '../lib/format';

interface KeysPageProps {
  onKeysChanged: () => void;
}

export function KeysPage({ onKeysChanged }: KeysPageProps) {
  const { apiKeys, loading, createApiKey, deleteApiKey } = useApiKeys();
  const copy = useClipboard();

  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setGeneratedKey(null);

    const rawKey = await createApiKey(newKeyName.trim());
    setCreating(false);

    if (rawKey) {
      setGeneratedKey(rawKey);
      setNewKeyName('');
      onKeysChanged();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Revoke API Key ini? Aplikasi luar tidak akan bisa mengakses storage lagi.')) return;
    await deleteApiKey(id);
    onKeysChanged();
  };

  return (
    <div className="overview-grid">
      <div className="dashboard-panel">
        <h3>Buat API Key Baru</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem', marginTop: '0.25rem' }}>
          API Key memungkinkan skrip luar atau server lain mengunggah dan mengunduh berkas secara programmatic.
        </p>

        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label" htmlFor="api-key-name">Nama Deskripsi Key</label>
            <input
              className="form-input"
              id="api-key-name"
              type="text"
              placeholder="Contoh: Skrip Backup Otomatis, App Mobile"
              value={newKeyName}
              onChange={event => setNewKeyName(event.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={creating} style={{ marginTop: '0.5rem' }}>
            {creating ? <Spinner size={18} /> : 'Buat API Key'}
          </button>
        </form>

        {generatedKey && (
          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            border: '1px solid var(--success-border)',
            backgroundColor: 'var(--success-bg)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 600 }}>
              <CheckCircle style={{ width: 18, height: 18 }} />
              <span>API Key berhasil dibuat.</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              SALIN KEY INI SEKARANG. Key tidak dapat dilihat lagi demi alasan keamanan.
            </p>
            <div className="secure-key-container">
              <span className="secure-key-text">{generatedKey}</span>
              <button className="btn btn-secondary btn-icon-only" onClick={() => void copy(generatedKey)}>
                <Copy style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-panel">
        <h3>API Key Aktif</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem', marginTop: '0.25rem' }}>
          Revoke segera jika Anda mencurigai sebuah key bocor.
        </p>

        {loading ? (
          <Spinner block padding="2rem" />
        ) : apiKeys.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: 'var(--text-muted)',
            border: '1px dashed var(--border-muted)',
            borderRadius: 'var(--radius-md)'
          }}>
            Belum ada API Key aktif.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Key</th>
                  <th>Dibuat</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map(key => (
                  <tr key={key.id}>
                    <td style={{ fontWeight: 600 }}>{key.name}</td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDate(key.createdAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-danger btn-icon-only"
                        onClick={() => void handleDelete(key.id)}
                        title="Revoke key"
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
