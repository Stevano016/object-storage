import { Folder, Pencil, Trash2 } from 'lucide-react';
import type { FolderItem } from '../../types';

interface FolderCardProps {
  folder: FolderItem;
  onOpen: (folder: FolderItem) => void;
  /** Both omitted for accounts that may not reshape the bucket. */
  onRename?: (folder: FolderItem) => void;
  onDelete?: (folder: FolderItem) => void;
}

/** How full a folder is, in the fewest words that are still accurate. */
function summarize(folder: FolderItem): string {
  const parts: string[] = [];
  if (folder.subfolderCount > 0) parts.push(`${folder.subfolderCount} folder`);
  if (folder.fileCount > 0) parts.push(`${folder.fileCount} berkas`);
  return parts.length > 0 ? parts.join(' · ') : 'Kosong';
}

export function FolderCard({ folder, onOpen, onRename, onDelete }: FolderCardProps) {
  return (
    <div className="folder-card" onClick={() => onOpen(folder)} title={`Buka '${folder.name}'`}>
      <Folder className="folder-card-icon" />

      <div className="folder-card-info">
        <span className="folder-card-name" title={folder.name}>{folder.name}</span>
        <span className="folder-card-meta">{summarize(folder)}</span>
      </div>

      {(onRename || onDelete) && (
        // stopPropagation: these sit inside the card, and clicking the card opens
        // the folder — which is the last thing you want when reaching for delete.
        <div className="folder-card-actions" onClick={event => event.stopPropagation()}>
          {onRename && (
            <button
              className="btn btn-secondary btn-icon-only"
              onClick={() => onRename(folder)}
              title="Ganti nama folder"
            >
              <Pencil style={{ width: 14, height: 14 }} />
            </button>
          )}
          {onDelete && (
            <button
              className="btn btn-danger btn-icon-only"
              onClick={() => onDelete(folder)}
              title="Hapus folder"
            >
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
