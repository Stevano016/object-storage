import { RefreshCw } from 'lucide-react';
import { getTabLabel } from '../../lib/navigation';
import type { TabId } from '../../types';

interface HeaderProps {
  activeTab: TabId;
  onRefresh: () => void;
}

export function Header({ activeTab, onRefresh }: HeaderProps) {
  return (
    <header className="header">
      <h2>{getTabLabel(activeTab)}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          className="btn btn-secondary"
          onClick={onRefresh}
          style={{ padding: '0.5rem 0.75rem' }}
          title="Muat ulang data"
        >
          <RefreshCw style={{ width: 16, height: 16 }} />
        </button>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Server: Gentan VPS</span>
      </div>
    </header>
  );
}
