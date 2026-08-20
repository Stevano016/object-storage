import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Link2, Trash2 } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { FieldError } from '../components/ui/FieldError';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useClipboard } from '../hooks/useClipboard';
import { useShares } from '../hooks/useShares';
import { buildShareUrl } from '../lib/files';
import { formatDate, formatDateTime } from '../lib/format';
import type { Bucket, SharePermission, ShareLink } from '../types';

const EXPIRY_OPTIONS = [
  { value: '', label: 'Tidak pernah kedaluwarsa' },
  { value: '1', label: '1 hari' },
  { value: '7', label: '7 hari' },
  { value: '30', label: '30 hari' },
  { value: '365', label: '1 tahun' }
];

interface SharesPageProps {
  buckets: Bucket[];
}

export function SharesPage({ buckets }: SharesPageProps) {
  const { apiUrl } = useAuth();
  const confirm = useConfirm();
  const { shares, loading, refresh, createShare, updateShare, revokeShare } = useShares();
  const copy = useClipboard();

  const [bucketName, setBucketName] = useState('');
  const [permission, setPermission] = useState<SharePermission>('viewer');
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState<ShareLink | null>(null);
  const [bucketError, setBucketError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!bucketName && buckets.length > 0) setBucketName(buckets[0].name);
  }, [bucketName, buckets]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    // Reachable when the instance has no buckets yet: the select falls back to an
    // empty value, and a share link with no bucket is meaningless.
    if (!bucketName) {
      setBucketError('Pilih bucket terlebih dahulu. Buat satu di tab Buckets bila belum ada.');
      return;
    }
    setBucketError(null);

    setCreating(true);

    const created = await createShare({
      bucketName,
      permission,
      label: label.trim() || undefined,
      expiresInDays: expiresInDays ? Number(expiresInDays) : undefined
    });

    setCreating(false);

    if (created) {
      setLastCreated(created);
      setLabel('');
      await refresh();
    }
  };

  const handleRevoke = async (share: ShareLink) => {
    const target = share.label || share.bucketName;
    const confirmed = await confirm({
      title: `Cabut tautan '${target}'?`,
      message: share.permission !== 'viewer'
        ? 'Tautan ini bisa mengunggah berkas. Mencabutnya menutup akses itu seketika, '
          + 'tapi berkas yang sudah diunggah lewat tautan ini tetap ada di bucket.'
        : 'Siapa pun yang sudah menyimpan tautan ini langsung kehilangan akses. Tautan tidak bisa dipulihkan.',
      confirmLabel: 'Cabut Tautan',
      danger: true
    });
    if (confirmed) void revokeShare(share.id);
  };

  return (
    <div>
      <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
        <h3>Buat Tautan Berbagi</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: '1.25rem' }}>
          Siapa pun yang memegang tautan bisa membukanya tanpa login. Pilih izinnya dengan hati-hati:
          tautan <strong>Unggah &amp; Hapus</strong> memberi orang asing kemampuan mengubah isi bucket.
        </p>

        <form onSubmit={handleCreate} noValidate>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="share-bucket">Bucket</label>
              <select
                className={`form-input${bucketError ? ' has-error' : ''}`}
                id="share-bucket"
                value={bucketName}
                onChange={event => { setBucketName(event.target.value); setBucketError(null); }}
                style={{ cursor: 'pointer' }}
                aria-invalid={bucketError ? true : undefined}
              >
                {buckets.length === 0 && <option value="">Belum ada bucket</option>}
                {buckets.map(bucket => (
                  <option key={bucket.id} value={bucket.name}>
                    {bucket.name} ({bucket.isPublic ? 'Publik' : 'Privat'})
                  </option>
                ))}
              </select>
              <FieldError message={bucketError} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="share-permission">Izin</label>
              <select
                className="form-input"
                id="share-permission"
                value={permission}
                onChange={event => setPermission(event.target.value as SharePermission)}
                style={{ cursor: 'pointer' }}
              >
                <option value="viewer">Hanya lihat &amp; unduh</option>
                <option value="uploader">Lihat &amp; Unggah (tidak bisa hapus/buat folder)</option>
                <option value="editor">Bisa unggah &amp; hapus (penuh)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="share-label">Catatan (opsional)</label>
              <input
                className="form-input"
                id="share-label"
                type="text"
                placeholder="Contoh: Untuk tim dokumentasi"
                value={label}
                onChange={event => setLabel(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="share-expiry">Masa berlaku</label>
              <select
                className="form-input"
                id="share-expiry"
                value={expiresInDays}
                onChange={event => setExpiresInDays(event.target.value)}
                style={{ cursor: 'pointer' }}
              >
                {EXPIRY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={creating || buckets.length === 0}
            style={{ marginTop: '0.5rem' }}
          >
            {creating ? <Spinner size={18} /> : <Link2 style={{ width: 18, height: 18 }} />}
            Buat Tautan
          </button>
        </form>

        {lastCreated && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            border: '1px solid var(--success-border)',
            backgroundColor: 'var(--success-bg)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 600 }}>
              <Link2 style={{ width: 18, height: 18 }} />
              <span>Tautan siap dibagikan</span>
            </div>
            <div className="secure-key-container">
              <span className="secure-key-text">{buildShareUrl(apiUrl, lastCreated.token)}</span>
              <button
                className="btn btn-secondary btn-icon-only"
                onClick={() => void copy(buildShareUrl(apiUrl, lastCreated.token))}
              >
                <Copy style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <Spinner block />
      ) : shares.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="Belum ada tautan berbagi"
          description="Buat tautan di atas untuk memberi akses tanpa login ke sebuah bucket."
        />
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tautan</th>
                <th>Cakupan</th>
                <th>Izin</th>
                <th>Kedaluwarsa</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {shares.map(share => {
                const url = buildShareUrl(apiUrl, share.token);
                const expired = share.expiresAt ? new Date(share.expiresAt).getTime() <= Date.now() : false;

                return (
                  <tr key={share.id}>
                    <td className="cell-stacked" data-label="Tautan">
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {share.label || share.bucketName}
                      </div>
                      <code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{url}</code>
                    </td>
                    <td className="cell-stacked" data-label="Cakupan">
                      <div>{share.bucketName}</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {share.fileName ? `Berkas: ${share.fileName}` : 'Seluruh bucket'}
                      </span>
                    </td>
                    <td className="cell-stacked" data-label="Izin">
                      <select
                        className="form-input"
                        value={share.permission}
                        onChange={event => void updateShare(share.id, {
                          permission: event.target.value as SharePermission
                        })}
                        style={{ cursor: 'pointer', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                        title="Ubah izin tautan"
                      >
                        <option value="viewer">Lihat &amp; Unduh</option>
                        <option value="uploader">Lihat &amp; Unggah</option>
                        <option value="editor">Unggah &amp; Hapus</option>
                      </select>
                    </td>
                    <td
                      className="cell-stacked"
                      data-label="Kedaluwarsa"
                      style={{ fontSize: '0.85rem', color: expired ? 'var(--danger)' : undefined }}
                    >
                      {share.expiresAt
                        ? `${expired ? 'Kedaluwarsa ' : 'Sampai '}${formatDateTime(share.expiresAt)}`
                        : 'Tidak pernah'}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Dibuat {formatDate(share.createdAt)}
                      </div>
                    </td>
                    <td data-label="Aksi" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-icon-only"
                          onClick={() => void copy(url)}
                          title="Salin tautan"
                        >
                          <Copy style={{ width: 16, height: 16 }} />
                        </button>
                        <a
                          className="btn btn-secondary btn-icon-only"
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Buka tautan"
                        >
                          <ExternalLink style={{ width: 16, height: 16 }} />
                        </a>
                        <button
                          className="btn btn-danger btn-icon-only"
                          onClick={() => void handleRevoke(share)}
                          title="Cabut tautan"
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
    </div>
  );
}
