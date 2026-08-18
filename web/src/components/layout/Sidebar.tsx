import { HardDrive, LogOut, Shield, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getVisibleNavItems } from '../../lib/navigation';
import { ROLE_LABELS } from '../ui/RoleBadge';
import type { TabId } from '../../types';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { user, isSuperAdmin, logout } = useAuth();
  const navItems = getVisibleNavItems(isSuperAdmin);
  const AvatarIcon = isSuperAdmin ? Shield : User;

  return (
    <aside className="sidebar">
      <div className="brand">
        <HardDrive style={{ width: 24, height: 24 }} />
        <span>Gentan Storage</span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexGrow: 1 }}>
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-btn ${activeTab === id ? 'active' : ''}`}
            onClick={() => onTabChange(id)}
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
        <button className="nav-btn" onClick={logout} style={{ color: 'var(--danger)' }}>
          <LogOut style={{ width: 18, height: 18 }} />
          Keluar
        </button>
      </div>
    </aside>
  );
}
