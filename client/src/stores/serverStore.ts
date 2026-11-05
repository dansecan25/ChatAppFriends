import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as serverApi from '@/api/serverApi';
import { loadRootKeys } from '@/services/crypto/keyring';
import { useAuthStore } from '@/stores/authStore';
import type { MemberDto, RoleDto, ServerDto } from '@/types/dto';
import { PERMISSIONS, type Permission } from '@/utils/permissions';

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
  const everyone = ref<Permission[]>([]);
  const auth = useAuthStore();

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
    const [list, { everyone: base, roles: all }] = await Promise.all([
      serverApi.fetchMembers(activeId.value),
      serverApi.fetchRoles(activeId.value),
    ]);
    [members.value, roles.value, everyone.value] = [list, all, base];
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

  /**
   * Works out what someone may do in the server on screen, the way the server does. It only decides what to show:
   * the server checks every action itself.
   */
  function permissionsOf(userId: number): Set<Permission> {
    const member = memberFor(userId);
    if (!member) return new Set();
    const granted = [
      ...everyone.value,
      ...roles.value.filter((role) => member.roleIds.includes(role.id)).flatMap((role) => role.permissions),
    ];
    return new Set(member.isOwner || granted.includes('administrator') ? PERMISSIONS : granted);
  }

  const myPermissions = computed(() => permissionsOf(auth.user?.id ?? 0));

  /** Tells whether the signed-in user has a permission here. */
  const can = (permission: Permission): boolean => myPermissions.value.has(permission);

  /** People can rename, delete and limit their own channels, and those who manage channels can do it to any. */
  const canManageChannel = (channel: { createdBy: number | null }): boolean =>
    channel.createdBy === auth.user?.id || can('manageChannels');

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
    everyone.value = [];
    activeId.value = null;
    loaded.value = false;
  }

  return {
    servers,
    loaded,
    activeId,
    active,
    members,
    roles,
    everyone,
    myPermissions,
    fetchServers,
    fetchMembership,
    select,
    memberFor,
    permissionsOf,
    can,
    canManageChannel,
    applyRename,
    applyPresence,
    reset,
  };
});
