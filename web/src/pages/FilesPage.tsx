import { useState } from 'react';
import { File as FileIcon, Folder, FolderPlus, Search, UploadCloud } from 'lucide-react';
import { FileCard } from '../components/files/FileCard';
import { FileDetailModal } from '../components/files/FileDetailModal';
import { FolderBreadcrumb } from '../components/files/FolderBreadcrumb';
import { FolderCard } from '../components/files/FolderCard';
import { FolderNameModal } from '../components/files/FolderNameModal';
import { MoveFileModal } from '../components/files/MoveFileModal';
import { UploadModal } from '../components/files/UploadModal';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useFiles } from '../hooks/useFiles';
import { useShares } from '../hooks/useShares';
import { buildFileUrl } from '../lib/files';
import type { Bucket, FileItem, FolderItem } from '../types';

interface FilesPageProps {
  buckets: Bucket[];
  activeBucket: string;
  onActiveBucketChange: (bucketName: string) => void;
  /** Bucket sizes and dashboard counters must follow every upload or delete. */
  onStorageChanged: () => void;
}

export function FilesPage({
  buckets,
  activeBucket,
  onActiveBucketChange,
  onStorageChanged
}: FilesPageProps) {
  const { apiUrl, token, isSuperAdmin } = useAuth();
  const confirm = useConfirm();
  const { createShare } = useShares();
  const {
    files,
    folders,
    path,
    folderId,
    openFolder,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFile,
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
  } = useFiles(activeBucket);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<FolderItem | null>(null);
  const [movingFile, setMovingFile] = useState<FileItem | null>(null);

  // Where the breadcrumb currently points, used in dialog copy.
  const locationLabel = path.length > 0 ? `folder '${path[path.length - 1].name}'` : `akar bucket '${activeBucket}'`;

  /** Names only what the folder actually holds, so the warning stays believable. */
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

    const deleted = await deleteFolder(folder);
    if (deleted) onStorageChanged();
  };

  const bucket = buckets.find(item => item.name === activeBucket);
  // Private buckets need the session token attached to preview and download URLs.
  const credential = bucket && !bucket.isPublic && token
    ? ({ kind: 'token', value: token } as const)
    : undefined;

  const handleUpload = (files: File[]) => {
    void uploadFiles(files, () => {
      setShowUploadModal(false);
      onStorageChanged();
    });
  };

  const handleDelete = async (fileId: string) => {
    const deleted = await deleteFile(fileId);
    if (deleted) {
      setSelectedFile(null);
      onStorageChanged();
    }
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void load(1, search);
  };

  return (
    <div>
      <div className="explorer-header">
        <div className="explorer-controls">
          {/* Decorative only, and it would sit alone on its own row once the
              controls wrap on a phone. */}
          <Folder className="desktop-only" style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <select
            className="form-input bucket-select"
            value={activeBucket}
            onChange={event => onActiveBucketChange(event.target.value)}
          >
            <option value="">Pilih Bucket...</option>
            {buckets.map(item => (
              <option key={item.id} value={item.name}>
                {item.name} ({item.isPublic ? 'Publik' : 'Privat'})
              </option>
            ))}
          </select>

          {activeBucket && (
            <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
              <UploadCloud style={{ width: 18, height: 18 }} />
              Unggah File
            </button>
          )}

          {activeBucket && isSuperAdmin && (
            <button className="btn btn-secondary" onClick={() => setShowCreateFolder(true)}>
              <FolderPlus style={{ width: 18, height: 18 }} />
              Buat Folder
            </button>
          )}
        </div>

        {activeBucket && (
          <form className="search-input-wrapper" onSubmit={handleSearchSubmit}>
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

      {activeBucket && (
        <FolderBreadcrumb bucketName={activeBucket} path={path} onNavigate={openFolder} />
      )}

      {!activeBucket ? (
        <EmptyState
          icon={Folder}
          title="Belum ada Bucket yang terpilih"
          description="Pilih salah satu bucket dari daftar di atas untuk melihat isi berkasnya."
        />
      ) : loading ? (
        <Spinner block padding="5rem" />
      ) : files.length === 0 && folders.length === 0 ? (
        <EmptyState
          icon={FileIcon}
          title={path.length > 0 ? 'Folder Kosong' : 'Bucket Kosong'}
          description={
            path.length > 0
              ? `Belum ada apa pun di dalam folder '${path[path.length - 1].name}'.`
              : `Belum ada berkas di dalam bucket '${activeBucket}'.`
          }
          action={
            <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
              Unggah File Pertama
            </button>
          }
        />
      ) : (
        <div>
          {/* Folders first, in their own grid: they are navigation, not content,
              and mixing them into the file grid made both harder to scan. */}
          {folders.length > 0 && (
            <div className="folder-grid">
              {folders.map(folder => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  onOpen={item => openFolder(item.id)}
                  onRename={isSuperAdmin ? setRenamingFolder : undefined}
                  onDelete={isSuperAdmin ? item => void handleDeleteFolder(item) : undefined}
                />
              ))}
            </div>
          )}

          <div className="file-grid">
            {files.map(file => (
              <FileCard
                key={file.id}
                file={file}
                previewUrl={buildFileUrl({ apiUrl, bucketName: activeBucket, file, credential })}
                onSelect={setSelectedFile}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
              <button
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => void load(page - 1, search)}
              >
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

      {showCreateFolder && (
        <FolderNameModal
          locationLabel={locationLabel}
          onSubmit={createFolder}
          onClose={() => setShowCreateFolder(false)}
        />
      )}

      {renamingFolder && (
        <FolderNameModal
          initialName={renamingFolder.name}
          locationLabel={locationLabel}
          onSubmit={name => renameFolder(renamingFolder, name)}
          onClose={() => setRenamingFolder(null)}
        />
      )}

      {movingFile && (
        <MoveFileModal
          file={movingFile}
          bucketName={activeBucket}
          currentFolderId={folderId}
          onMove={async (fileId, target) => {
            const moved = await moveFile(fileId, target);
            if (moved) setSelectedFile(null);
            return moved;
          }}
          onClose={() => setMovingFile(null)}
        />
      )}

      {showUploadModal && (
        <UploadModal
          bucketName={activeBucket}
          uploading={uploading}
          items={uploads}
          onUpload={handleUpload}
          onClose={() => { setShowUploadModal(false); resetUploads(); }}
        />
      )}

      {selectedFile && (
        <FileDetailModal
          file={selectedFile}
          bucketName={activeBucket}
          bucket={bucket}
          canDelete={isSuperAdmin}
          canShare={isSuperAdmin}
          onMove={isSuperAdmin ? setMovingFile : undefined}
          onDelete={fileId => void handleDelete(fileId)}
          onCreateShare={fileId => createShare({
            bucketName: activeBucket,
            fileId,
            permission: 'viewer',
            label: `Berkas: ${selectedFile.originalName}`
          })}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}
