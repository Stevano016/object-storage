import { useState } from 'react';
import { AlertTriangle, Eye, File as FileIcon, HardDrive, Pencil, Search, UploadCloud } from 'lucide-react';
import { FileCard } from '../components/files/FileCard';
import { FilePreviewModal } from '../components/files/FilePreviewModal';
import { UploadModal } from '../components/files/UploadModal';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { Toaster } from '../components/ui/Toaster';
import { useShareBrowser } from '../hooks/useShareBrowser';
import { buildFileUrl } from '../lib/files';
import { formatDateTime } from '../lib/format';
import type { FileItem } from '../types';

function ShareShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-container">
      <main className="main-content">{children}</main>
      <Toaster />
    </div>
  );
}

export function SharePage({ token }: { token: string }) {
  const {
    apiUrl,
    info,
    invalidReason,
    initializing,
    files,
    loading,
    page,
    totalPages,
    search,
    setSearch,
    load,
    uploading,
    uploads,
    uploadFiles,
    resetUploads,
    deleteFile
  } = useShareBrowser(token);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  if (initializing) {
    return <ShareShell><Spinner block padding="6rem" /></ShareShell>;
  }

  if (invalidReason || !info) {
    return (
      <ShareShell>
        <div className="page-body">
          <EmptyState
            icon={AlertTriangle}
            title="Tautan tidak dapat dibuka"
            description={invalidReason || 'Tautan berbagi tidak valid atau sudah dicabut oleh pemiliknya.'}
          />
        </div>
      </ShareShell>
    );
  }

  const canEdit = info.permission === 'editor';
  const credential = { kind: 'share', value: token } as const;

  const handleDelete = async (fileId: string) => {
    const deleted = await deleteFile(fileId);
    if (deleted) setSelectedFile(null);
  };

  return (
    <ShareShell>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <HardDrive style={{ width: 22, height: 22, color: 'var(--accent-primary)', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {info.label || info.bucketName}
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Dibagikan lewat Gentan Storage
              {info.expiresAt ? ` · berlaku sampai ${formatDateTime(info.expiresAt)}` : ''}
            </span>
          </div>
        </div>

        <span className={`badge ${canEdit ? 'badge-private' : 'badge-public'}`}>
          {canEdit
            ? <><Pencil style={{ width: 12, height: 12 }} />Bisa Unggah &amp; Hapus</>
            : <><Eye style={{ width: 12, height: 12 }} />Hanya Lihat &amp; Unduh</>}
        </span>
      </header>

      <div className="page-body">
        <div className="explorer-header">
          <div className="explorer-controls">
            {canEdit && (
              <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                <UploadCloud style={{ width: 18, height: 18 }} />
                Unggah File
              </button>
            )}
            {info.scope === 'file' && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Tautan ini hanya berisi satu berkas.
              </span>
            )}
          </div>

          {info.scope === 'bucket' && (
            <form
              className="search-input-wrapper"
              onSubmit={event => {
                event.preventDefault();
                void load(1, search);
              }}
            >
              <Search />
              <input
                className="form-input"
                type="text"
                placeholder="Cari berkas..."
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </form>
          )}
        </div>

        {loading ? (
          <Spinner block padding="5rem" />
        ) : files.length === 0 ? (
          <EmptyState
            icon={FileIcon}
            title="Belum ada berkas"
            description={canEdit
              ? 'Unggah berkas pertama melalui tombol di atas.'
              : 'Pemilik tautan belum mengunggah berkas apa pun.'}
            action={canEdit ? (
              <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                Unggah File Pertama
              </button>
            ) : undefined}
          />
        ) : (
          <div>
            <div className="file-grid">
              {files.map(file => (
                <FileCard
                  key={file.id}
                  file={file}
                  previewUrl={buildFileUrl({ apiUrl, bucketName: info.bucketName, file, credential })}
                  onSelect={setSelectedFile}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
                <button className="btn btn-secondary" disabled={page <= 1} onClick={() => void load(page - 1, search)}>
                  Sebelumnya
                </button>
                <span style={{ alignSelf: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Halaman {page} dari {totalPages}
                </span>
                <button
                  className="btn btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => void load(page + 1, search)}
                >
                  Selanjutnya
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showUploadModal && (
        <UploadModal
          bucketName={info.bucketName}
          uploading={uploading}
          items={uploads}
          onUpload={files => void uploadFiles(files, () => setShowUploadModal(false))}
          onClose={() => { setShowUploadModal(false); resetUploads(); }}
        />
      )}

      {selectedFile && (
        <FilePreviewModal
          file={selectedFile}
          mediaUrl={buildFileUrl({ apiUrl, bucketName: info.bucketName, file: selectedFile, credential })}
          downloadUrl={buildFileUrl({
            apiUrl,
            bucketName: info.bucketName,
            file: selectedFile,
            credential,
            download: true
          })}
          onDelete={canEdit ? () => void handleDelete(selectedFile.id) : undefined}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </ShareShell>
  );
}
