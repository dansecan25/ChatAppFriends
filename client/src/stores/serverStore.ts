import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as serverApi from '@/api/serverApi';
import { loadRootKeys } from '@/services/crypto/keyring';
import type { MemberDto, RoleDto, ServerDto } from '@/types/dto';

const ACTIVE_SERVER_KEY = 'chatapp-active-server';

const readStoredServerId = (): number | null => {
  try {
    return Number(localStorage.getItem(ACTIVE_SERVER_KEY)) || null;
  } catch {
    return null;
  }
};

export const useServerStore = defineStore('servers', () => {
  const servers = ref<ServerDto[]>([]);
  const loaded = ref(false);
  const activeId = ref<number | null>(null);
  const members = ref<MemberDto[]>([]);
  const roles = ref<RoleDto[]>([]);

  const active = computed(() => servers.value.find((server) => server.id === activeId.value) ?? null);

  /** Loads the user's servers and their keys, keeping the current server when it's still available. */
  async function fetchServers(): Promise<void> {
    servers.value = await serverApi.fetchServers();
    servers.value.forEach((server) => loadRootKeys(server.id, server.rootKeyVersion, server.rootKeys));
    const preferred = activeId.value ?? readStoredServerId();
    activeId.value = servers.value.find((server) => server.id === preferred)?.id ?? servers.value[0]?.id ?? null;
    loaded.value = true;
  }

  /** Loads the active server's members and roles. */
  async function fetchMembership(): Promise<void> {
    if (activeId.value === null) return;
    [members.value, roles.value] = await Promise.all([
      serverApi.fetchMembers(activeId.value),
      serverApi.fetchRoles(activeId.value),
    ]);
  }

  /** Switches server. */
  function select(id: number): void {
    activeId.value = id;
    try {
      localStorage.setItem(ACTIVE_SERVER_KEY, String(id));
    } catch {
      // The choice just won't be remembered.
    }
  }

  /** Applies a rename from anyone in the server. */
  function applyRename(id: number, name: string): void {
    const server = servers.value.find((candidate) => candidate.id === id);
    if (server) server.name = name;
  }

  /** Finds someone in the server on screen. */
  const memberFor = (userId: number): MemberDto | undefined => members.value.find((member) => member.id === userId);

  /** Updates someone's online status in the server on screen. */
  function applyPresence(serverId: number, userId: number, online: boolean): void {
    if (serverId !== activeId.value) return;
    const member = members.value.find((candidate) => candidate.id === userId);
    if (member) member.online = online;
  }

  /** Clears everything on sign-out. */
  function reset(): void {
    servers.value = [];
    members.value = [];
    roles.value = [];
    activeId.value = null;
    loaded.value = false;
  }

  return { servers, loaded, activeId, active, members, roles, fetchServers, fetchMembership, select, memberFor, applyRename, applyPresence, reset };
});
