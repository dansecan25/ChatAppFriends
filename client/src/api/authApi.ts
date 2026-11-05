import { toUser } from '@/mappers/userMapper';
import type { UserDto } from '@/types/dto';
import type { User } from '@/types/models';
import { request } from './http';

/** Returns the signed-in user. */
export const fetchCurrentUser = async (): Promise<User> => toUser(await request<UserDto>('/auth/me'));

/** Signs in with a username and password. */
export const login = async (username: string, password: string): Promise<User> =>
  toUser(await request<UserDto>('/auth/login', { method: 'POST', body: { username, password } }));

/** Creates an account using an invite code. */
export const register = async (username: string, password: string, inviteCode: string): Promise<User> =>
  toUser(await request<UserDto>('/auth/register', { method: 'POST', body: { username, password, inviteCode } }));

/** Ends the current session. */
export const logout = (): Promise<void> => request('/auth/logout', { method: 'POST' });
