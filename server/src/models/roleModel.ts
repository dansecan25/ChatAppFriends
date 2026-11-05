import { pool } from '../connections/mariadb.js';

export interface Role {
  id: number;
  serverId: number;
  name: string;
  /** The built-in Admin role, which can't be deleted or lose its permissions. */
  isAdmin: boolean;
  /** Permission bits, see utils/permissions. */
  permissions: number;
}

const toRole = (row: any): Role => ({ ...row, isAdmin: Boolean(row.isAdmin) });

const SELECT_ROLE = 'SELECT id, server_id AS serverId, name, is_admin AS isAdmin, permissions FROM roles';

/** Lists a server's roles. */
export async function listRoles(serverId: number): Promise<Role[]> {
  return (await pool.query(`${SELECT_ROLE} WHERE server_id = ? ORDER BY is_admin DESC, id`, [serverId])).map(toRole);
}

/** Finds a role by id. */
export async function findRoleById(id: number): Promise<Role | null> {
  const rows = await pool.query(`${SELECT_ROLE} WHERE id = ?`, [id]);
  return rows[0] ? toRole(rows[0]) : null;
}

/** Creates a role. */
export async function insertRole(serverId: number, name: string, permissions: number): Promise<Role> {
  const result = await pool.query('INSERT INTO roles (server_id, name, permissions) VALUES (?, ?, ?)', [
    serverId,
    name,
    permissions,
  ]);
  return { id: result.insertId, serverId, name, isAdmin: false, permissions };
}

/** Renames a role and replaces its permissions. */
export async function updateRole(id: number, name: string, permissions: number): Promise<void> {
  await pool.query('UPDATE roles SET name = ?, permissions = ? WHERE id = ?', [name, permissions, id]);
}

/** Deletes a role. */
export async function deleteRole(id: number): Promise<void> {
  await pool.query('DELETE FROM roles WHERE id = ?', [id]);
}

/** Returns each member's role ids in a server, keyed by user id. */
export async function listMemberRoleIds(serverId: number): Promise<Map<number, number[]>> {
  const rows: { userId: number; roleId: number }[] = await pool.query(
    `SELECT mr.user_id AS userId, mr.role_id AS roleId
     FROM member_roles mr JOIN roles r ON r.id = mr.role_id WHERE r.server_id = ?`,
    [serverId],
  );
  const result = new Map<number, number[]>();
  for (const { userId, roleId } of rows) result.set(userId, [...(result.get(userId) ?? []), roleId]);
  return result;
}

/** Replaces a member's roles in a server. */
export async function setMemberRoles(serverId: number, userId: number, roleIds: number[]): Promise<void> {
  await pool.query(
    `DELETE mr FROM member_roles mr JOIN roles r ON r.id = mr.role_id WHERE r.server_id = ? AND mr.user_id = ?`,
    [serverId, userId],
  );
  for (const roleId of roleIds) {
    await pool.query('INSERT INTO member_roles (role_id, user_id) VALUES (?, ?)', [roleId, userId]);
  }
}

/** Returns the permission bits of all of a member's roles in a server combined. */
export async function memberRolePermissions(serverId: number, userId: number): Promise<number> {
  const rows = await pool.query(
    `SELECT BIT_OR(r.permissions) AS bits FROM member_roles mr JOIN roles r ON r.id = mr.role_id
     WHERE r.server_id = ? AND mr.user_id = ?`,
    [serverId, userId],
  );
  return Number(rows[0]?.bits ?? 0);
}
