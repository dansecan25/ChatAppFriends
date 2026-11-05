<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import * as channelApi from '@/api/channelApi';
import * as serverApi from '@/api/serverApi';
import { useAuthStore } from '@/stores/authStore';
import { useChannelStore } from '@/stores/channelStore';
import { useServerStore } from '@/stores/serverStore';
import type { MemberDto } from '@/types/dto';
import type { Channel } from '@/types/models';
import { errorMessage } from '@/utils/errors';
import { covers, type Permission } from '@/utils/permissions';
import RoleEditor from './RoleEditor.vue';

const emit = defineEmits<{ close: [] }>();

const auth = useAuthStore();
const servers = useServerStore();
const channels = useChannelStore();

const dialog = ref<HTMLDialogElement>();
const name = ref(servers.active?.name ?? '');
const newRole = ref('');
const joinCode = ref('');
const revokedCode = ref('');
const notice = ref<string | null>(null);
const error = ref<string | null>(null);

const serverId = computed(() => servers.activeId as number);
const isOwner = computed(() => auth.user?.isOwner === true);
const mine = computed(() => servers.myPermissions);
const managesRoles = computed(() => servers.can('manageRoles'));
const restrictedChannels = computed(() =>
  channels.channels.filter((channel) => channel.restricted && servers.canManageChannel(channel)),
);

/** Runs an action and shows any failure. */
async function attempt(action: () => Promise<unknown>): Promise<void> {
  error.value = null;
  notice.value = null;
  try {
    await action();
  } catch (err) {
    error.value = errorMessage(err);
  }
}

const rename = () => attempt(() => serverApi.renameServer(serverId.value, name.value));

const addRole = () =>
  attempt(async () => {
    await serverApi.createRole(serverId.value, newRole.value);
    newRole.value = '';
    await servers.fetchMembership();
  });

const removeRole = (roleId: number) =>
  attempt(async () => {
    await serverApi.deleteRole(serverId.value, roleId);
    await servers.fetchMembership();
  });

const saveRole = (roleId: number, change: { name?: string; permissions: Permission[] }) =>
  attempt(async () => {
    await serverApi.updateRole(serverId.value, roleId, change);
    await servers.fetchMembership();
  });

const saveEveryone = ({ permissions }: { permissions: Permission[] }) =>
  attempt(async () => {
    await serverApi.setEveryonePermissions(serverId.value, permissions);
    await servers.fetchMembership();
  });

/** Roles can only be given or taken away by someone holding all of their permissions. */
const canAssign = (role: { permissions: Permission[] }) => managesRoles.value && covers(mine.value, role.permissions);

/** Adds or removes one role on a list of role ids. */
const toggled = (roleIds: number[], roleId: number) =>
  roleIds.includes(roleId) ? roleIds.filter((id) => id !== roleId) : [...roleIds, roleId];

const toggleMemberRole = (member: MemberDto, roleId: number) =>
  attempt(async () => {
    await serverApi.setMemberRoles(serverId.value, member.id, toggled(member.roleIds, roleId));
    await servers.fetchMembership();
  });

const toggleChannelRole = (channel: Channel, roleId: number) =>
  attempt(async () => {
    await channelApi.setChannelRoles(channel.id, toggled(channel.roleIds, roleId));
    await channels.fetchChannels(serverId.value);
  });

/** Members can only be removed by someone holding all of their permissions. */
const canRemove = (member: MemberDto) =>
  servers.can('removeMembers') &&
  !member.isOwner &&
  member.id !== auth.user?.id &&
  covers(mine.value, [...servers.permissionsOf(member.id)]);

const removeMember = (member: MemberDto) =>
  attempt(async () => {
    const warning =
      `Remove ${member.username}? They won't be able to read anything new. They can rejoin with this server's code ` +
      'until you revoke it and put a new one in INVITE_CODE.';
    if (!window.confirm(warning)) return;
    await serverApi.removeMember(serverId.value, member.id);
    await servers.fetchMembership();
  });

/** Joins the server a code belongs to, and opens it. */
const joinServer = () =>
  attempt(async () => {
    const known = new Set(servers.servers.map((server) => server.id));
    await auth.redeem(joinCode.value);
    await servers.fetchServers();
    joinCode.value = '';
    const joined = servers.servers.find((server) => !known.has(server.id));
    if (joined) servers.select(joined.id);
    notice.value = joined ? `You joined ${joined.name}.` : 'You are already in that server.';
  });

/** Blacklists a code. The server needs a new code in INVITE_CODE before anyone else can join it. */
const revokeCode = () =>
  attempt(async () => {
    await serverApi.revokeCode(revokedCode.value);
    revokedCode.value = '';
    notice.value = 'Code revoked. Put a new one in INVITE_CODE and restart the backend.';
  });

onMounted(async () => {
  dialog.value?.showModal();
  await attempt(servers.fetchMembership);
});
</script>

<template>
  <dialog ref="dialog" class="modal" @close="emit('close')">
    <div class="modal-body">
      <h2>Server settings</h2>

      <form v-if="servers.can('manageServer')" class="inline-form" aria-label="Rename server" @submit.prevent="rename">
        <input v-model="name" required maxlength="50" aria-label="Server name" />
        <button class="btn">Rename</button>
      </form>

      <p v-else class="hint">{{ servers.active?.name }}</p>

      <section v-if="managesRoles" class="modal-body">
        <h3>Roles</h3>
        <ul class="plain-list">
          <li>
            <RoleEditor :name="null" :permissions="servers.everyone" :mine="mine" @save="saveEveryone" />
          </li>
          <li v-for="role in servers.roles" :key="role.id">
            <RoleEditor
              :name="role.name"
              :permissions="role.permissions"
              :built-in="role.isAdmin"
              :mine="mine"
              @save="saveRole(role.id, $event)"
              @remove="removeRole(role.id)"
            />
          </li>
        </ul>
        <form class="inline-form" @submit.prevent="addRole">
          <input v-model="newRole" required maxlength="32" placeholder="New role" aria-label="New role name" />
          <button class="btn">Add role</button>
        </form>
      </section>

      <section class="modal-body">
        <h3>Members</h3>
        <ul class="plain-list">
          <li v-for="member in servers.members" :key="member.id">
            <div class="row">
              <span class="who">
                <strong>{{ member.nickname ?? member.username }}</strong>
                <span v-if="member.nickname" class="account">{{ member.username }}</span>
              </span>
              <button v-if="canRemove(member)" class="btn small" @click="removeMember(member)">Remove</button>
            </div>
            <div v-if="managesRoles" class="choices">
              <label v-for="role in servers.roles" :key="role.id">
                <input
                  type="checkbox"
                  :checked="member.roleIds.includes(role.id)"
                  :disabled="!canAssign(role)"
                  @change="toggleMemberRole(member, role.id)"
                />{{ role.name }}
              </label>
            </div>
            <p v-else class="hint">
              {{ servers.roles.filter((role) => member.roleIds.includes(role.id)).map((role) => role.name).join(', ') }}
            </p>
          </li>
        </ul>
      </section>

      <section v-if="restrictedChannels.length" class="modal-body">
        <h3>Restricted channels you can see</h3>
        <ul class="plain-list">
          <li v-for="channel in restrictedChannels" :key="channel.id">
            <strong>{{ channel.name }}</strong>
            <div class="choices">
              <label v-for="role in servers.roles" :key="role.id">
                <input
                  type="checkbox"
                  :checked="channel.roleIds.includes(role.id)"
                  @change="toggleChannelRole(channel, role.id)"
                />{{ role.name }}
              </label>
            </div>
          </li>
        </ul>
      </section>

      <section class="modal-body">
        <h3>Join another server in this app</h3>
        <form class="inline-form" @submit.prevent="joinServer">
          <input v-model="joinCode" required autocomplete="off" placeholder="Invite code" aria-label="Invite code to join" />
          <button class="btn">Join</button>
        </form>
      </section>

      <section v-if="isOwner" class="modal-body">
        <h3>Revoke an invite code</h3>
        <p class="hint">People who already joined keep their access.</p>
        <form class="inline-form" @submit.prevent="revokeCode">
          <input v-model="revokedCode" required autocomplete="off" placeholder="Code to revoke" aria-label="Invite code to revoke" />
          <button class="btn">Revoke</button>
        </form>
      </section>

      <p v-if="notice" class="hint" role="status">{{ notice }}</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="modal-actions"><button class="btn" @click="emit('close')">Close</button></div>
    </div>
  </dialog>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.who {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.account {
  color: var(--text-faint);
  font-size: 0.72rem;
}

.small {
  padding: 0.3rem 0.6rem;
  font-size: 0.85rem;
}
</style>
