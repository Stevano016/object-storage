import { FileVideo } from 'lucide-react';
import { FileTypeIcon } from '../ui/FileTypeIcon';
import { Spinner } from '../ui/Spinner';
import { formatBytes, formatDate } from '../../lib/format';
import { getFileKind } from '../../lib/files';
import { useHeicPreview } from '../../hooks/useHeicPreview';
import { THUMBNAIL_MAX_EDGE } from '../../lib/heic';
import type { FileItem } from '../../types';

interface FileCardProps {
  file: FileItem;
  previewUrl: string;
  onSelect: (file: FileItem) => void;
}

/**
 * Thumbnail for an image. HEIC goes through the decoder first, which is why this
 * is a component rather than an inline <img> — the hook may only run for images.
 */
function ImageThumb({ file, previewUrl }: { file: FileItem; previewUrl: string }) {
  const { src, decoding, error, isHeic } = useHeicPreview(file, previewUrl, THUMBNAIL_MAX_EDGE);

  if (decoding) {
    return (
      <div className="thumb-placeholder">
        <Spinner size={22} />
        <span>Membaca HEIC…</span>
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className="thumb-placeholder">
        <FileTypeIcon mimeType={file.mimeType} />
        <span>{isHeic ? 'HEIC tidak terbaca' : 'Pratinjau gagal'}</span>
      </div>
    );
  }

  return <img src={src} alt={file.originalName} loading="lazy" />;
}

export function FileCard({ file, previewUrl, onSelect }: FileCardProps) {
  const kind = getFileKind(file.mimeType);

  return (
    <div className="file-card" onClick={() => onSelect(file)}>
      <div className="file-card-preview">
        {kind === 'image' ? (
          <ImageThumb file={file} previewUrl={previewUrl} />
        ) : kind === 'video' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
            <FileVideo className="file-card-icon" style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Video Player</span>
          </div>
        ) : (
          <FileTypeIcon mimeType={file.mimeType} />
        )}
      </div>
      <div className="file-card-info">
        <span className="file-card-name" title={file.originalName}>{file.originalName}</span>
        <div className="file-card-meta">
          <span>{formatBytes(file.size)}</span>
          <span>{formatDate(file.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
