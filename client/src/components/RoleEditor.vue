<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { covers, PERMISSION_DETAILS, PERMISSIONS, type Permission } from '@/utils/permissions';

const props = defineProps<{
  /** Null for what everyone can do, which has no name. */
  name: string | null;
  permissions: Permission[];
  /** The built-in Admin role, which always keeps every permission. */
  builtIn?: boolean;
  /** What the person editing may do themselves. */
  mine: ReadonlySet<Permission>;
}>();
const emit = defineEmits<{ save: [change: { name?: string; permissions: Permission[] }]; remove: [] }>();

const draftName = ref(props.name ?? '');
const draft = ref<Permission[]>([...props.permissions]);
watch(
  () => [props.name, props.permissions] as const,
  ([name, permissions]) => {
    draftName.value = name ?? '';
    draft.value = [...permissions];
  },
);

/** A role holding permissions this person lacks is out of their reach, like Discord's role order. */
const editable = computed(() => covers(props.mine, props.permissions));
const canToggle = (permission: Permission) =>
  editable.value && props.mine.has(permission) && !(props.builtIn && permission === 'administrator');
const summary = computed(() => {
  const count = props.permissions.length;
  if (props.permissions.includes('administrator')) return 'All permissions';
  return count === 0 ? 'No permissions' : count === 1 ? '1 permission' : `${count} permissions`;
});
const changed = computed(
  () =>
    (props.name !== null && draftName.value.trim() !== props.name) ||
    draft.value.length !== props.permissions.length ||
    draft.value.some((permission) => !props.permissions.includes(permission)),
);

/** Sends the changes, in the server's permission order. */
function save(): void {
  const permissions = PERMISSIONS.filter((permission) => draft.value.includes(permission));
  emit('save', props.name === null ? { permissions } : { name: draftName.value.trim(), permissions });
}
</script>

<template>
  <details class="role">
    <summary>
      <span>{{ name ?? 'Everyone' }}</span>
      <span class="count">{{ summary }}</span>
    </summary>
    <form class="editor" @submit.prevent="save">
      <p v-if="name === null" class="hint">What every member can do, before any role.</p>
      <p v-else-if="!editable" class="hint">This role has permissions you don't have, so you can't change it.</p>
      <input
        v-if="name !== null"
        v-model="draftName"
        required
        maxlength="32"
        :disabled="!editable"
        aria-label="Role name"
        class="name"
      />
      <label v-for="permission in PERMISSIONS" :key="permission" class="permission">
        <input v-model="draft" type="checkbox" :value="permission" :disabled="!canToggle(permission)" />
        <span>
          <strong>{{ PERMISSION_DETAILS[permission].label }}</strong>
          <span class="hint">{{ PERMISSION_DETAILS[permission].description }}</span>
        </span>
      </label>
      <div v-if="editable" class="modal-actions">
        <button v-if="name !== null && !builtIn" type="button" class="btn" @click="emit('remove')">Delete role</button>
        <button class="btn btn-primary" :disabled="!changed">Save</button>
      </div>
    </form>
  </details>
</template>

<style scoped>
.role {
  border: 1px solid var(--border);
  border-radius: 8px;
}

summary {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  cursor: pointer;
}

.count {
  color: var(--text-faint);
  font-size: 0.8rem;
}

.editor {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0 0.7rem 0.7rem;
}

.name {
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-deep);
}

.permission {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.permission input {
  margin-top: 0.25rem;
}

.permission > span {
  display: flex;
  flex-direction: column;
}

.permission input:disabled + span {
  opacity: 0.6;
}
</style>
