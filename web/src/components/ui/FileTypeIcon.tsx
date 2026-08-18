import { File, FileAudio, FileImage, FileText, FileVideo } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getFileKind } from '../../lib/files';
import type { FileKind } from '../../lib/files';

const ICONS: Record<FileKind, LucideIcon> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  document: FileText,
  other: File
};

interface FileTypeIconProps {
  mimeType: string;
  className?: string;
  style?: React.CSSProperties;
}

export function FileTypeIcon({ mimeType, className = 'file-card-icon', style }: FileTypeIconProps) {
  const Icon = ICONS[getFileKind(mimeType)];
  return <Icon className={className} style={style} />;
}
