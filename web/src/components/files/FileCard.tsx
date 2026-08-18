import { FileVideo } from 'lucide-react';
import { FileTypeIcon } from '../ui/FileTypeIcon';
import { formatBytes, formatDate } from '../../lib/format';
import { getFileKind } from '../../lib/files';
import type { FileItem } from '../../types';

interface FileCardProps {
  file: FileItem;
  previewUrl: string;
  onSelect: (file: FileItem) => void;
}

export function FileCard({ file, previewUrl, onSelect }: FileCardProps) {
  const kind = getFileKind(file.mimeType);

  return (
    <div className="file-card" onClick={() => onSelect(file)}>
      <div className="file-card-preview">
        {kind === 'image' ? (
          <img src={previewUrl} alt={file.originalName} loading="lazy" />
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
