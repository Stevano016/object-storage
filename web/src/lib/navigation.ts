import { File, Folder, HardDrive, Key, Settings, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TabId } from '../types';

export interface NavItem {
  id: TabId;
  label: string;
  icon: LucideIcon;
  /** Hidden from regular users, who may only upload and view. */
  superAdminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: HardDrive },
  { id: 'files', label: 'File Browser', icon: File },
  { id: 'buckets', label: 'Buckets', icon: Folder, superAdminOnly: true },
  { id: 'keys', label: 'API Keys', icon: Key, superAdminOnly: true },
  { id: 'users', label: 'Manajemen User', icon: Users, superAdminOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings }
];

export function getVisibleNavItems(isSuperAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter(item => isSuperAdmin || !item.superAdminOnly);
}

export function getTabLabel(tab: TabId): string {
  return NAV_ITEMS.find(item => item.id === tab)?.label ?? tab;
}
