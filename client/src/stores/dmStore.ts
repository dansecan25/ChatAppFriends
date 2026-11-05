import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as dmApi from '@/api/dmApi';
import { loadDmKey, wrapForMember, wrapForSelf } from '@/services/crypto/keyring';
import { assertPinnedKey } from '@/services/crypto/identity';
import { newSymmetricKey } from '@/services/crypto/primitives';
import type { DmDto, MemberDto } from '@/types/dto';

export const useDmStore = defineStore('dms', () => {
  const dms = ref<DmDto[]>([]);

  const unlock = async (dm: DmDto): Promise<void> => {
    if (dm.otherUser.publicKey) await assertPinnedKey(dm.otherUser.id, dm.otherUser.username, dm.otherUser.publicKey);
    await loadDmKey(dm.id, dm.wrappedKey);
  };

  /** Loads the user's conversations and unlocks their keys. */
  async function fetchDms(): Promise<void> {
    const list = await dmApi.fetchDms();
    await Promise.all(list.map(unlock));
    dms.value = list;
  }

  /** Opens a conversation with a member, creating a key only the two of you can open. */
  async function open(member: MemberDto): Promise<DmDto> {
    const existing = dms.value.find((dm) => dm.otherUser.id === member.id);
    if (existing) return existing;
    const raw = newSymmetricKey();
    const dm = await dmApi.openDm(member.id, await wrapForSelf(raw), await wrapForMember(raw, member));
    await unlock(dm);
    dms.value.push(dm);
    return dm;
  }

  /** Clears everything on sign-out. */
  function reset(): void {
    dms.value = [];
  }

  return { dms, fetchDms, open, reset };
});
