import { Shield, User } from 'lucide-react';
import type { UserRole } from '../../types';

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Super Admin',
  user: 'User Biasa'
};

export function RoleBadge({ role }: { role: UserRole }) {
  const isSuperAdmin = role === 'superadmin';
  const Icon = isSuperAdmin ? Shield : User;

  return (
    <span className={`badge ${isSuperAdmin ? 'badge-public' : 'badge-private'}`}>
      <Icon style={{ width: 12, height: 12 }} />
      {ROLE_LABELS[role]}
    </span>
  );
}
