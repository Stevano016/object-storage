import { useState } from 'react';
import { Eye, Folder, Gauge, Globe, Lock, Plus, Trash2 } from 'lucide-react';
import { BucketQuotaModal } from '../components/buckets/BucketQuotaModal';
import { useConfirm } from '../context/ConfirmContext';
import { CreateBucketModal } from '../components/buckets/CreateBucketModal';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { formatBytes, formatDate, formatPercent } from '../lib/format';
import type { Bucket } from '../types';

interface BucketsPageProps {
  buckets: Bucket[];
  loading: boolean;
  onCreate: (name: string, isPublic: boolean, quotaBytes: number | null) => Promise<boolean>;
  onDelete: (name: string) => Promise<boolean>;
  onToggleVisibility: (bucket: Bucket, isPublic: boolean) => Promise<void>;
  onSetQuota: (bucket: Bucket, quotaBytes: number | null) => Promise<boolean>;
  onOpenBucket: (name: string) => void;
}

/** Usage cell: a plain byte total when unlimited, a meter when a quota is set. */
function QuotaCell({ bucket }: { bucket: Bucket }) {
  if (!bucket.quotaBytes) {
    return (
      <>
        {formatBytes(bucket.totalSize)}
        <span className="quota-caption">Tanpa batas</span>
      </>
    );
  }

  const percent = formatPercent(bucket.totalSize, bucket.quotaBytes);
  // 90% is early enough to act on, 100% means the next upload is already refused.
  const state = percent >= 100 ? 'is-full' : percent >= 90 ? 'is-warning' : '';

  return (
    <>
      {formatBytes(bucket.totalSize)} / {formatBytes(bucket.quotaBytes)}
      <div className="quota-bar">
        <div className={`quota-bar-fill ${state}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="quota-caption">
        {percent >= 100
          ? 'Kuota penuh — unggahan ditolak'
          : `${Math.round(percent)}% terpakai`}
      </span>
    </>
  );
}

export function BucketsPage({
  buckets,
  loading,
  onCreate,
  onDelete,
  onToggleVisibility,
  onSetQuota,
  onOpenBucket
}: BucketsPageProps) {
  const confirm = useConfirm();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [quotaBucket, setQuotaBucket] = useState<Bucket | null>(null);

  const handleDelete = async (bucket: Bucket) => {
    const confirmed = await confirm({
      title: `Hapus bucket '${bucket.name}'?`,
      message: bucket.fileCount > 0
        ? `Bucket ini berisi ${bucket.fileCount} berkas (${formatBytes(bucket.totalSize)}). Semuanya ikut terhapus dari server dan tidak bisa dikembalikan.`
        : 'Bucket ini masih kosong. Menghapusnya tidak menghilangkan berkas apa pun.',
      confirmLabel: 'Hapus Bucket',
      danger: true
    });
    if (confirmed) void onDelete(bucket.name);
  };

  return (
    <div>
      <div className="page-heading">
        <h3>Daftar Storage Buckets</h3>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus style={{ width: 18, height: 18 }} />
          Buat Bucket Baru
        </button>
      </div>

      {loading ? (
        <Spinner block />
      ) : buckets.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="Belum ada Bucket"
          description="Buat bucket pertama Anda untuk mengelompokkan berkas foto atau video yang diunggah."
          action={
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              Buat Bucket Baru
            </button>
          }
        />
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Bucket</th>
                <th>Status Akses</th>
                <th>Jumlah File</th>
                <th>Ukuran / Kuota</th>
                <th>Tanggal Dibuat</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map(bucket => (
                <tr key={bucket.id}>
                  <td data-label="Bucket" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{bucket.name}</td>
                  <td data-label="Akses">
                    <button
                      style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                      onClick={() => void onToggleVisibility(bucket, !bucket.isPublic)}
                      title="Klik untuk mengubah visibilitas"
                    >
                      <span className={`badge ${bucket.isPublic ? 'badge-public' : 'badge-private'}`}>
                        {bucket.isPublic
                          ? <><Globe style={{ width: 12, height: 12 }} />Publik</>
                          : <><Lock style={{ width: 12, height: 12 }} />Privat</>}
                      </span>
                    </button>
                  </td>
                  <td data-label="Berkas">{bucket.fileCount} berkas</td>
                  <td data-label="Ukuran"><QuotaCell bucket={bucket} /></td>
                  <td data-label="Dibuat">{formatDate(bucket.createdAt)}</td>
                  <td data-label="Aksi" style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-icon-only"
                        onClick={() => onOpenBucket(bucket.name)}
                        title="Buka berkas di bucket ini"
                      >
                        <Eye style={{ width: 16, height: 16 }} />
                      </button>
                      <button
                        className="btn btn-secondary btn-icon-only"
                        onClick={() => setQuotaBucket(bucket)}
                        title="Atur kuota penyimpanan"
                      >
                        <Gauge style={{ width: 16, height: 16 }} />
                      </button>
                      <button
                        className="btn btn-danger btn-icon-only"
                        onClick={() => void handleDelete(bucket)}
                        title="Hapus bucket"
                      >
                        <Trash2 style={{ width: 16, height: 16 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <CreateBucketModal onClose={() => setShowCreateModal(false)} onCreate={onCreate} />
      )}

      {quotaBucket && (
        <BucketQuotaModal
          bucket={quotaBucket}
          onClose={() => setQuotaBucket(null)}
          onSave={onSetQuota}
        />
      )}
    </div>
  );
}
