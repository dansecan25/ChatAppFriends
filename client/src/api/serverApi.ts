import type { MemberDto, RoleDto, ServerDto } from '@/types/dto';
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

/** Lists a server's roles. */
export const fetchRoles = (id: number): Promise<RoleDto[]> => request(`/servers/${id}/roles`);

/** Creates a role. */
export const createRole = (id: number, name: string): Promise<RoleDto> =>
  request(`/servers/${id}/roles`, { method: 'POST', body: { name } });

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
