<script setup lang="ts">
import { computed } from 'vue';
import { displayName as nameOf } from '@/composables/useUserDisplay';
import { membersOf } from '@/stores/channelStore';
import { useServerStore } from '@/stores/serverStore';
import type { Channel } from '@/types/models';
import UserAvatar from './UserAvatar.vue';

const props = defineProps<{ channel: Channel }>();

const servers = useServerStore();

const allowed = computed(() =>
  membersOf(props.channel, servers.members).toSorted((a, b) => nameOf(a).localeCompare(nameOf(b))),
);
const groups = computed(() => [
  { label: 'Online', people: allowed.value.filter((member) => member.online) },
  { label: 'Offline', people: allowed.value.filter((member) => !member.online) },
]);
</script>

<template>
  <aside class="list" aria-label="Channel members">
    <template v-for="group in groups" :key="group.label">
      <section v-if="group.people.length">
        <h2>{{ group.label }} — {{ group.people.length }}</h2>
        <ul>
          <li v-for="person in group.people" :key="person.id" :class="{ away: !person.online }">
            <span class="avatar">
              <UserAvatar :user-id="person.id" :username="nameOf(person)" :avatar-id="person.avatarId" :size="30" />
              <span class="bubble" :class="{ on: person.online }" :title="group.label" />
            </span>
            <span class="who">
              <span class="name">{{ nameOf(person) }}</span>
              <span v-if="person.nickname" class="account">{{ person.username }}</span>
            </span>
          </li>
        </ul>
      </section>
    </template>
  </aside>
</template>

<style scoped>
.list {
  height: 100dvh;
  overflow-y: auto;
  padding: 0.75rem 0.6rem;
  border-left: 1px solid var(--border);
  background: var(--bg-sidebar);
}

section + section {
  margin-top: 1.1rem;
}

h2 {
  margin: 0 0 0.25rem;
  padding: 0 0.5rem;
  color: var(--text-faint);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.3rem 0.5rem;
  border-radius: 8px;
}

.away {
  opacity: 0.55;
}

.avatar {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.bubble {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 12px;
  height: 12px;
  border: 2px solid var(--bg-sidebar);
  border-radius: 50%;
  background: #80848e;
}

.bubble.on {
  background: #23a55a;
}

.who {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.account {
  overflow: hidden;
  color: var(--text-faint);
  font-size: 0.72rem;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
