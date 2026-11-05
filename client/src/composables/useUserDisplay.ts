import { useAuthStore } from '@/stores/authStore';
import { useDmStore } from '@/stores/dmStore';
import { useServerStore } from '@/stores/serverStore';
import type { MemberDto } from '@/types/dto';

/** A nickname if they set one in this server, otherwise their account name. */
export const displayName = (member: MemberDto): string => member.nickname ?? member.username;

/** Works out how to show someone: their nickname in the server on screen, or their account name elsewhere. */
export function useUserDisplay() {
  const auth = useAuthStore();
  const servers = useServerStore();
  const dms = useDmStore();

  /** Returns the name to show for someone in the current server, with a fallback for people who have left. */
  const nameFor = (userId: number, fallback: string): string => {
    const member = servers.memberFor(userId);
    return member?.nickname ?? member?.username ?? fallback;
  };

  /** Returns someone's profile picture, wherever they can be found. */
  const avatarFor = (userId: number): string | null => {
    if (userId === auth.user?.id) return auth.user.avatarId;
    return (
      servers.memberFor(userId)?.avatarId ??
      dms.dms.find((dm) => dm.otherUser.id === userId)?.otherUser.avatarId ??
      null
    );
  };

  return { nameFor, avatarFor };
}
