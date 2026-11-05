import type { MemberDto, RoleDto, RolesDto, ServerDto } from '@/types/dto';
import type { Permission } from '@/utils/permissions';
import { request } from './http';

/** Lists the user's servers. */
export const fetchServers = (): Promise<ServerDto[]> => request('/servers');

/** Renames a server. */
export const renameServer = (id: number, name: string): Promise<void> =>
  request(`/servers/${id}`, { method: 'PATCH', body: { name } });

/** Lists a server's members. */
export const fetchMembers = (id: number): Promise<MemberDto[]> => request(`/servers/${id}/members`);

/** Removes a member from a server. */
export const removeMember = (id: number, userId: number): Promise<void> =>
  request(`/servers/${id}/members/${userId}`, { method: 'DELETE' });

/** Lists a server's roles and what every member can do. */
export const fetchRoles = (id: number): Promise<RolesDto> => request(`/servers/${id}/roles`);

/** Creates a role. */
export const createRole = (id: number, name: string): Promise<RoleDto> =>
  request(`/servers/${id}/roles`, { method: 'POST', body: { name } });

/** Renames a role or replaces its permissions. */
export const updateRole = (id: number, roleId: number, change: { name?: string; permissions: Permission[] }): Promise<void> =>
  request(`/servers/${id}/roles/${roleId}`, { method: 'PATCH', body: change });

/** Replaces what every member can do. */
export const setEveryonePermissions = (id: number, permissions: Permission[]): Promise<void> =>
  request(`/servers/${id}/everyone`, { method: 'PUT', body: { permissions } });

/** Deletes a role. */
export const deleteRole = (id: number, roleId: number): Promise<void> =>
  request(`/servers/${id}/roles/${roleId}`, { method: 'DELETE' });

/** Replaces a member's roles. */
export const setMemberRoles = (id: number, userId: number, roleIds: number[]): Promise<void> =>
  request(`/servers/${id}/members/${userId}/roles`, { method: 'PUT', body: { roleIds } });

/** Joins a server with an invite code while signed in. */
export const redeemCode = (code: string): Promise<void> => request('/invites/redeem', { method: 'POST', body: { code } });

/** Blacklists an invite code. */
export const revokeCode = (code: string): Promise<void> => request('/invites/revoke', { method: 'POST', body: { code } });
