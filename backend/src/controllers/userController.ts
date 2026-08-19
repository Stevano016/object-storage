import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, hashPassword, UserRole } from '../utils/db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { validatePasswordStrength } from '../utils/password.js';

const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,32}$/;
const ROLES: UserRole[] = ['superadmin', 'user'];

interface UserRow {
  id: string;
  username: string;
  role: UserRole;
  created_at: string;
}

const toUserDto = (row: UserRow) => ({
  id: row.id,
  username: row.username,
  role: row.role,
  createdAt: row.created_at
});

function validateUsername(username: unknown): string | null {
  if (typeof username !== 'string' || !USERNAME_REGEX.test(username)) {
    return 'Username must be 3-32 characters and may only contain letters, numbers, dot, underscore or hyphen.';
  }
  return null;
}

/** Same policy the self-service password change uses, so neither path is weaker. */
function validatePassword(password: unknown, username?: unknown): string | null {
  return validatePasswordStrength(password, typeof username === 'string' ? username : undefined);
}

function validateRole(role: unknown): string | null {
  if (!ROLES.includes(role as UserRole)) {
    return `Role must be one of: ${ROLES.join(', ')}.`;
  }
  return null;
}

async function countSuperadmins(): Promise<number> {
  const row = await getDb().get(`SELECT COUNT(*) as count FROM users WHERE role = 'superadmin'`);
  return row?.count || 0;
}

export async function listUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const rows = await getDb().all<UserRow[]>(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at ASC'
    );
    res.json(rows.map(toUserDto));
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response) {
  const { username, password, role = 'user' } = req.body;

  const validationError =
    validateUsername(username) || validatePassword(password, username) || validateRole(role);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const db = getDb();

    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(409).json({ error: 'A user with this username already exists.' });
    }

    const id = uuidv4();
    await db.run(
      'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
      [id, username, await hashPassword(password), role]
    );

    const created = await db.get<UserRow>('SELECT id, username, role, created_at FROM users WHERE id = ?', [id]);
    res.status(201).json({ ...toUserDto(created!), message: `User '${username}' created successfully.` });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { username, password, role } = req.body;

  if (username === undefined && password === undefined && role === undefined) {
    return res.status(400).json({ error: 'Provide at least one of: username, password, role.' });
  }

  try {
    const db = getDb();
    const target = await db.get<UserRow>('SELECT id, username, role, created_at FROM users WHERE id = ?', [id]);

    if (!target) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (username !== undefined) {
      const usernameError = validateUsername(username);
      if (usernameError) return res.status(400).json({ error: usernameError });

      const clash = await db.get('SELECT id FROM users WHERE username = ? AND id != ?', [username, id]);
      if (clash) return res.status(409).json({ error: 'A user with this username already exists.' });

      updates.push('username = ?');
      params.push(username);
    }

    if (password !== undefined) {
      const nextUsername = username === undefined ? target.username : username;
      const passwordError = validatePassword(password, nextUsername);
      if (passwordError) return res.status(400).json({ error: passwordError });

      updates.push('password_hash = ?');
      params.push(await hashPassword(password));

      // An admin resetting someone's password also ends that account's sessions,
      // which is the point of the reset when an account is suspected stolen.
      updates.push('password_changed_at = ?');
      params.push(db.toTimestamp(new Date()));
    }

    if (role !== undefined && role !== target.role) {
      const roleError = validateRole(role);
      if (roleError) return res.status(400).json({ error: roleError });

      if (target.id === req.user?.id) {
        return res.status(400).json({ error: 'You cannot change your own role.' });
      }

      // Losing the last superadmin would lock everyone out of user management.
      if (target.role === 'superadmin' && (await countSuperadmins()) <= 1) {
        return res.status(400).json({ error: 'Cannot demote the last remaining superadmin.' });
      }

      updates.push('role = ?');
      params.push(role);
    }

    if (updates.length > 0) {
      params.push(id);
      await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updated = await db.get<UserRow>('SELECT id, username, role, created_at FROM users WHERE id = ?', [id]);
    res.json({ ...toUserDto(updated!), message: 'User updated successfully.' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function deleteUser(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  try {
    const db = getDb();
    const target = await db.get<UserRow>('SELECT id, username, role, created_at FROM users WHERE id = ?', [id]);

    if (!target) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (target.id === req.user?.id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    if (target.role === 'superadmin' && (await countSuperadmins()) <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last remaining superadmin.' });
    }

    await db.run('DELETE FROM users WHERE id = ?', [id]);

    res.json({ message: `User '${target.username}' deleted successfully.` });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
