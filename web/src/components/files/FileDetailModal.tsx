import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { FilePreviewModal } from './FilePreviewModal';
import type { PreviewLink } from './FilePreviewModal';
import { Spinner } from '../ui/Spinner';
import { useAuth } from '../../context/AuthContext';
import { buildFileUrl, buildPublicFileUrl, buildShareUrl } from '../../lib/files';
import type { Bucket, FileItem, ShareLink } from '../../types';

interface FileDetailModalProps {
  file: FileItem;
  bucketName: string;
  bucket: Bucket | undefined;
  canDelete: boolean;
  canShare: boolean;
  onDelete: (fileId: string) => void;
  /** Mints a public, login-free link to this single file. */
  onCreateShare: (fileId: string) => Promise<ShareLink | null>;
  onClose: () => void;
}

export function FileDetailModal({
  file,
  bucketName,
  bucket,
  canDelete,
  canShare,
  onDelete,
  onCreateShare,
  onClose
}: FileDetailModalProps) {
  const { apiUrl, token } = useAuth();
  const [share, setShare] = useState<ShareLink | null>(null);
  const [sharing, setSharing] = useState(false);

  const isPrivate = bucket ? !bucket.isPublic : false;
  const credential = isPrivate && token ? ({ kind: 'token', value: token } as const) : undefined;

  const mediaUrl = buildFileUrl({ apiUrl, bucketName, file, credential });
  const downloadUrl = buildFileUrl({ apiUrl, bucketName, file, credential, download: true });
  const directUrl = buildPublicFileUrl(apiUrl, bucketName, file);

  const links: PreviewLink[] = [
    isPrivate
      ? {
          label: 'URL langsung (butuh login atau API key):',
          display: directUrl,
          copyValue: directUrl,
          warning: true
        }
      : {
          label: 'URL publik (bisa dibuka siapa saja):',
          display: directUrl,
          copyValue: directUrl
        }
  ];

  if (isPrivate && token) {
    links.push({
      label: 'Tautan terotentikasi (JWT, ikut kedaluwarsa sesi):',
      display: `${directUrl}&token=${token.substring(0, 15)}...`,
      copyValue: mediaUrl,
      warning: true
    });
  }

  if (share) {
    links.push({
      label: 'Tautan berbagi publik — tanpa login:',
      display: buildShareUrl(apiUrl, share.token),
      copyValue: buildShareUrl(apiUrl, share.token)
    });
  }

  const handleShare = async () => {
    setSharing(true);
    const created = await onCreateShare(file.id);
    setSharing(false);
    if (created) setShare(created);
  };

  return (
    <FilePreviewModal
      file={file}
      mediaUrl={mediaUrl}
      downloadUrl={downloadUrl}
      links={links}
      onDelete={canDelete ? () => onDelete(file.id) : undefined}
      onClose={onClose}
      extraActions={
        canShare && !share ? (
          <button className="btn btn-secondary" onClick={() => void handleShare()} disabled={sharing}>
            {sharing ? <Spinner size={16} /> : <Link2 style={{ width: 16, height: 16 }} />}
            Buat Tautan Berbagi
          </button>
        ) : undefined
      }
    />
  );
}
