import { useState } from 'react';
import { AlertTriangle, Eye, File as FileIcon, Pencil, Search, UploadCloud, FolderPlus } from 'lucide-react';
import { FileCard } from '../components/files/FileCard';
import { FilePreviewModal } from '../components/files/FilePreviewModal';
import { UploadModal } from '../components/files/UploadModal';
import { FolderBreadcrumb } from '../components/files/FolderBreadcrumb';
import { FolderCard } from '../components/files/FolderCard';
import { FolderNameModal } from '../components/files/FolderNameModal';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { Toaster } from '../components/ui/Toaster';
import { useShareBrowser } from '../hooks/useShareBrowser';
import { useConfirm } from '../context/ConfirmContext';
import { buildFileUrl } from '../lib/files';
import { formatDateTime } from '../lib/format';
import type { FileItem, FolderItem } from '../types';

function ShareShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-container">
      <main className="main-content">{children}</main>
      <Toaster />
    </div>
  );
}

export function SharePage({ token }: { token: string }) {
  const confirm = useConfirm();
  const {
    apiUrl,
    info,
    invalidReason,
    initializing,
    files,
    folders,
    path,
    openFolder,
    createFolder,
    renameFolder,
    deleteFolder,
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
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<FolderItem | null>(null);

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

  const canUpload = info.permission === 'editor' || info.permission === 'uploader';
  const canDelete = info.permission === 'editor';
  const canManageFolders = info.permission === 'editor';
  const credential = { kind: 'share', value: token } as const;

  const handleDelete = async (fileId: string) => {
    const deleted = await deleteFile(fileId);
    if (deleted) setSelectedFile(null);
  };

  const describeContents = (folder: FolderItem): string => {
    const parts: string[] = [];
    if (folder.subfolderCount > 0) parts.push(`${folder.subfolderCount} subfolder`);
    if (folder.fileCount > 0) parts.push(`${folder.fileCount} berkas`);

    if (parts.length === 0) {
      return 'Folder ini kosong, jadi tidak ada berkas yang hilang.';
    }

    const tail = folder.subfolderCount > 0
      ? 'Semuanya ikut terhapus dari server, termasuk seluruh isi subfoldernya, dan tidak bisa dikembalikan.'
      : 'Semuanya ikut terhapus dari server dan tidak bisa dikembalikan.';

    return `Folder ini memuat ${parts.join(' dan ')}. ${tail}`;
  };

  const handleDeleteFolder = async (folder: FolderItem) => {
    const confirmed = await confirm({
      title: `Hapus folder '${folder.name}'?`,
      message: describeContents(folder),
      confirmLabel: 'Hapus Folder',
      danger: true
    });
    if (!confirmed) return;

    await deleteFolder(folder);
  };

  return (
    <ShareShell>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <img src="/logo.png" alt="Logo" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} />
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

        <span className={`badge ${canUpload ? 'badge-private' : 'badge-public'}`}>
          {info.permission === 'editor' && (
            <><Pencil style={{ width: 12, height: 12 }} />Bisa Unggah &amp; Hapus</>
          )}
          {info.permission === 'uploader' && (
            <><UploadCloud style={{ width: 12, height: 12 }} />Bisa Unggah</>
          )}
          {info.permission === 'viewer' && (
            <><Eye style={{ width: 12, height: 12 }} />Hanya Lihat &amp; Unduh</>
          )}
        </span>
      </header>

      <div className="page-body">
        <div className="explorer-header">
          <div className="explorer-controls">
            {canUpload && (
              <>
                <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                  <UploadCloud style={{ width: 18, height: 18 }} />
                  Unggah File
                </button>
                {canManageFolders && info.scope === 'bucket' && (
                  <button className="btn btn-secondary" onClick={() => setShowCreateFolder(true)}>
                    <FolderPlus style={{ width: 18, height: 18 }} />
                    Buat Folder
                  </button>
                )}
              </>
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

        {info.scope === 'bucket' && (
          <FolderBreadcrumb bucketName={info.bucketName} path={path} onNavigate={openFolder} />
        )}

        {loading ? (
          <Spinner block padding="5rem" />
        ) : files.length === 0 && folders.length === 0 ? (
          <EmptyState
            icon={FileIcon}
            title={path.length > 0 ? 'Folder Kosong' : 'Belum ada berkas'}
            description={
              path.length > 0
                ? `Belum ada apa pun di dalam folder '${path[path.length - 1].name}'.`
                : canUpload
                  ? 'Unggah berkas pertama melalui tombol di atas.'
                  : 'Pemilik tautan belum mengunggah berkas apa pun.'
            }
            action={canUpload ? (
              <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                Unggah File Pertama
              </button>
            ) : undefined}
          />
        ) : (
          <div>
            {folders.length > 0 && (
              <div className="folder-grid">
                {folders.map(folder => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onOpen={item => openFolder(item.id)}
                    onRename={canManageFolders ? setRenamingFolder : undefined}
                    onDelete={canManageFolders ? item => void handleDeleteFolder(item) : undefined}
                  />
                ))}
              </div>
            )}

            {files.length > 0 && (
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
            )}

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

      {showCreateFolder && (
        <FolderNameModal
          locationLabel={path.length > 0 ? `folder '${path[path.length - 1].name}'` : `akar bucket '${info.bucketName}'`}
          onSubmit={createFolder}
          onClose={() => setShowCreateFolder(false)}
        />
      )}

      {renamingFolder && (
        <FolderNameModal
          initialName={renamingFolder.name}
          locationLabel={path.length > 0 ? `folder '${path[path.length - 1].name}'` : `akar bucket '${info.bucketName}'`}
          onSubmit={name => renameFolder(renamingFolder, name)}
          onClose={() => setRenamingFolder(null)}
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
          onDelete={canDelete ? () => void handleDelete(selectedFile.id) : undefined}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </ShareShell>
  );
}
