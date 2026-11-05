import { request } from './http';

/** Uploads a profile picture. */
export const putAvatar = (picture: Blob): Promise<{ avatarId: string }> =>
  request('/users/me/avatar', { method: 'PUT', blob: picture });

/** Removes the profile picture. */
export const deleteAvatar = (): Promise<void> => request('/users/me/avatar', { method: 'DELETE' });

/** Sets or clears a nickname in one server. An empty value clears it. */
export const putNickname = (serverId: number, nickname: string): Promise<void> =>
  request(`/servers/${serverId}/nickname`, { method: 'PUT', body: { nickname } });
