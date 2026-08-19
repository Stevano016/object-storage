import { ChevronRight, HardDrive } from 'lucide-react';
import type { FolderCrumb } from '../../types';

interface FolderBreadcrumbProps {
  bucketName: string;
  path: FolderCrumb[];
  onNavigate: (folderId: string | null) => void;
}

/**
 * The trail from the bucket root to the open folder.
 *
 * The last crumb is rendered as plain text rather than a button: it is where you
 * already are, and a control that does nothing is worse than no control.
 */
export function FolderBreadcrumb({ bucketName, path, onNavigate }: FolderBreadcrumbProps) {
  return (
    <nav className="breadcrumb" aria-label="Lokasi folder">
      <button
        className="breadcrumb-item"
        onClick={() => onNavigate(null)}
        disabled={path.length === 0}
        title={`Akar bucket '${bucketName}'`}
      >
        <HardDrive style={{ width: 14, height: 14 }} />
        {bucketName}
      </button>

      {path.map((crumb, index) => {
        const isCurrent = index === path.length - 1;
        return (
          <span key={crumb.id} className="breadcrumb-step">
            <ChevronRight className="breadcrumb-separator" />
            {isCurrent ? (
              <span className="breadcrumb-item is-current" aria-current="page">{crumb.name}</span>
            ) : (
              <button className="breadcrumb-item" onClick={() => onNavigate(crumb.id)}>
                {crumb.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
