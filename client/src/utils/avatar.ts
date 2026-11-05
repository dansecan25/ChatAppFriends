const AVATAR_HUES = [14, 38, 92, 152, 188, 214, 262, 300, 340];

/** Picks a stable color for a user id. */
export function avatarColor(userId: number): string {
  return `hsl(${AVATAR_HUES[userId % AVATAR_HUES.length]} 62% 58%)`;
}

/** Returns the letter shown in a user's avatar. */
export function avatarInitial(username: string): string {
  return username.charAt(0).toUpperCase();
}
