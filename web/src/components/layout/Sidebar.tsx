import { HardDrive, LogOut, Shield, User, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { getVisibleNavItems } from '../../lib/navigation';
import { ROLE_LABELS } from '../ui/RoleBadge';
import type { TabId } from '../../types';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  /** Below 900px the sidebar is an off-canvas drawer. */
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ activeTab, onTabChange, open, onClose }: SidebarProps) {
  const { user, isSuperAdmin, logout } = useAuth();
  const confirm = useConfirm();
  const navItems = getVisibleNavItems(isSuperAdmin);
  const AvatarIcon = isSuperAdmin ? Shield : User;

  // Asked because the button sits directly under the nav items and is easy to
  // hit by accident, especially in the mobile drawer where it is a full-width row.
  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Keluar dari dasbor?',
      message: 'Sesi Anda diakhiri di peramban ini dan Anda perlu memasukkan password lagi untuk masuk.',
      confirmLabel: 'Keluar'
    });
    if (confirmed) logout();
  };

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="brand" style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <HardDrive style={{ width: 24, height: 24 }} />
          Gentan Storage
        </span>
        <button
          className="btn btn-secondary btn-icon-only mobile-only"
          onClick={onClose}
          aria-label="Tutup menu"
        >
          <X style={{ width: 18, height: 18 }} />
        </button>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexGrow: 1 }}>
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-btn ${activeTab === id ? 'active' : ''}`}
            onClick={() => { onTabChange(id); onClose(); }}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', paddingLeft: '0.5rem' }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
            flexShrink: 0
          }}>
            <AvatarIcon style={{ width: 16, height: 16 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {user?.username}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {user ? ROLE_LABELS[user.role] : ''}
            </span>
          </div>
        </div>
        <button className="nav-btn" onClick={() => void handleLogout()} style={{ color: 'var(--danger)' }}>
          <LogOut style={{ width: 18, height: 18 }} />
          Keluar
        </button>
      </div>
    </aside>
  );
}
