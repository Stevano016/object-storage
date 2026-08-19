import { File, Folder, HardDrive, Key, ShieldAlert, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatBytes, formatPercent } from '../lib/format';
import type { Stats } from '../types';

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
}

function StatCard({ icon: Icon, value, label }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-icon"><Icon /></div>
      <div className="stat-info">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  );
}

function DiskPanel({ stats }: { stats: Stats }) {
  const { disk, diskLabel, storageProvider } = stats;
  const usesObjectStore = storageProvider !== 'local';

  return (
    <div className="dashboard-panel">
      <div className="panel-header">
        <h3>Penyimpanan VPS</h3>
        <span className={`badge ${usesObjectStore ? 'badge-public' : 'badge-private'}`}>
          {usesObjectStore ? storageProvider.toUpperCase() : 'DISK LOKAL'}
        </span>
      </div>

      <div style={{ marginTop: '1rem' }}>
        {disk ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              <span>{diskLabel || 'Kapasitas disk'}:</span>
              <span style={{ fontWeight: 600 }}>
                {formatBytes(disk.used)} / {formatBytes(disk.total)}
              </span>
            </div>
            <div className="progress-bar-container" style={{ height: '12px' }}>
              <div className="progress-bar-fill" style={{ width: `${formatPercent(disk.used, disk.total)}%` }} />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Sisa ruang kosong: <strong>{formatBytes(disk.free)}</strong>. Angka ini adalah kapasitas
              filesystem yang dipantau server, bukan kuota aplikasi.
            </p>
          </>
        ) : (
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Informasi kapasitas disk tidak tersedia di sistem ini.
          </p>
        )}

        <div className="detail-item" style={{ marginTop: '1rem' }}>
          <span className="detail-label">Ukuran folder data lokal</span>
          <span className="detail-value">{formatBytes(stats.physicalDiskSize)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Total ukuran berkas terdaftar</span>
          <span className="detail-value">{formatBytes(stats.totalSize)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The default password is printed in the repository's README, so an account that
 * still uses it is public knowledge the moment the dashboard is reachable from
 * the Internet. Shown to everyone, not just superadmins, because a regular user
 * whose own account is affected has to be the one to fix it.
 */
function DefaultPasswordWarning({ accounts }: { accounts: string[] }) {
  return (
    <div className="alert-banner alert-banner-danger" role="alert">
      <ShieldAlert className="alert-banner-icon" />
      <div>
        <div className="alert-banner-title">
          {accounts.length > 1
            ? `${accounts.length} akun masih memakai password bawaan`
            : 'Akun masih memakai password bawaan'}
        </div>
        Akun <strong>{accounts.join(', ')}</strong> masih bisa dimasuki dengan password
        yang tertulis di README proyek ini. Siapa pun yang menemukan alamat dasbor ini
        bisa masuk sebagai admin. Ganti sekarang di tab <strong>Pengaturan</strong>.
      </div>
    </div>
  );
}

export function OverviewPage({ stats }: { stats: Stats }) {
  const { apiUrl, isSuperAdmin } = useAuth();
  const defaultPasswordAccounts = stats.accountsUsingDefaultPassword ?? [];

  return (
    <div>
      {defaultPasswordAccounts.length > 0 && (
        <DefaultPasswordWarning accounts={defaultPasswordAccounts} />
      )}

      <div className="stats-grid">
        <StatCard icon={Folder} value={stats.buckets} label="Total Buckets" />
        <StatCard icon={File} value={stats.files} label="Total Files" />
        <StatCard icon={HardDrive} value={formatBytes(stats.totalSize)} label="Storage Used" />
        {isSuperAdmin
          ? <StatCard icon={Key} value={stats.apiKeys} label="Active API Keys" />
          : <StatCard icon={Users} value={stats.users} label="Pengguna Terdaftar" />}
      </div>

      <div className="overview-grid">
        <DiskPanel stats={stats} />

        <div className="dashboard-panel">
          <h3>Panduan Akses API</h3>
          <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <p>Gunakan header HTTP ini untuk program eksternal:</p>
            <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>X-API-Key: YOUR_API_KEY</code>
            <p>Endpoint URL Dasar:</p>
            <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
              {apiUrl}/api/buckets/[bucket_name]/files
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
