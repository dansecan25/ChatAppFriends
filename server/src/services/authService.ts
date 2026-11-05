import { createHash, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { findUserByUsername, insertUserWithinLimit, type AuthUser } from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

const DUMMY_HASH = await hashPassword('timing-equaliser');

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Registers a user after checking the invite code and the member limit. */
export async function register(username: string, password: string, inviteCode: string): Promise<AuthUser> {
  if (!timingSafeEqual(digest(inviteCode), digest(config.INVITE_CODE))) {
    throw new HttpError(403, 'Invalid invite code');
  }
  const passwordHash = await hashPassword(password);
  try {
    const id = await insertUserWithinLimit(username, passwordHash, config.MAX_USERS);
    if (id === null) throw new HttpError(403, `This server is full (${config.MAX_USERS} members)`);
    return { id, username };
  } catch (err) {
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new HttpError(409, 'That username is taken');
    throw err;
  }
}

/** Verifies credentials, spending equal time whether or not the user exists. */
export async function login(username: string, password: string): Promise<AuthUser> {
  const user = await findUserByUsername(username);
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, 'Wrong username or password');
  return { id: user.id, username: user.username };
}
