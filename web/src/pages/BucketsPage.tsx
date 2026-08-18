import { useState } from 'react';
import { Eye, Folder, Globe, Lock, Plus, Trash2 } from 'lucide-react';
import { CreateBucketModal } from '../components/buckets/CreateBucketModal';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { formatBytes, formatDate } from '../lib/format';
import type { Bucket } from '../types';

interface BucketsPageProps {
  buckets: Bucket[];
  loading: boolean;
  onCreate: (name: string, isPublic: boolean) => Promise<boolean>;
  onDelete: (name: string) => Promise<boolean>;
  onToggleVisibility: (bucket: Bucket, isPublic: boolean) => Promise<void>;
  onOpenBucket: (name: string) => void;
}

export function BucketsPage({
  buckets,
  loading,
  onCreate,
  onDelete,
  onToggleVisibility,
  onOpenBucket
}: BucketsPageProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleDelete = (name: string) => {
    const confirmed = window.confirm(
      `Hapus bucket '${name}' beserta seluruh isinya? Tindakan ini tidak bisa dibatalkan.`
    );
    if (confirmed) void onDelete(name);
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
                <th>Total Ukuran</th>
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
                  <td data-label="Ukuran">{formatBytes(bucket.totalSize)}</td>
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
                        className="btn btn-danger btn-icon-only"
                        onClick={() => handleDelete(bucket.name)}
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
    </div>
  );
}
