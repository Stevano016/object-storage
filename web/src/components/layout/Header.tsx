import { Menu, RefreshCw } from 'lucide-react';
import { getTabLabel } from '../../lib/navigation';
import type { TabId } from '../../types';

interface HeaderProps {
  activeTab: TabId;
  onRefresh: () => void;
  onOpenMenu: () => void;
}

export function Header({ activeTab, onRefresh, onOpenMenu }: HeaderProps) {
  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
        <button
          className="btn btn-secondary btn-icon-only mobile-only"
          onClick={onOpenMenu}
          aria-label="Buka menu"
        >
          <Menu style={{ width: 18, height: 18 }} />
        </button>
        <h2>{getTabLabel(activeTab)}</h2>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          className="btn btn-secondary"
          onClick={onRefresh}
          style={{ padding: '0.5rem 0.75rem' }}
          title="Muat ulang data"
        >
          <RefreshCw style={{ width: 16, height: 16 }} />
        </button>
        <span className="desktop-only" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Server: Gentan VPS
        </span>
      </div>
    </header>
  );
}
