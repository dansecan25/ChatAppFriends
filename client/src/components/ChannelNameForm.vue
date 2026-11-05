<script setup lang="ts">
import { onMounted, ref } from 'vue';

const props = defineProps<{ name: string }>();
const emit = defineEmits<{ save: [name: string]; cancel: [] }>();

const draft = ref(props.name);
const input = ref<HTMLInputElement>();

/** Saves a changed name, and just closes otherwise. */
function submit(): void {
  const name = draft.value.trim();
  if (name && name !== props.name) emit('save', name);
  else emit('cancel');
}

onMounted(() => input.value?.select());
</script>

<template>
  <form class="rename" @submit.prevent="submit">
    <input
      ref="input"
      v-model="draft"
      required
      maxlength="50"
      aria-label="Channel name"
      @keydown.esc="emit('cancel')"
      @blur="emit('cancel')"
    />
  </form>
</template>

<style scoped>
.rename {
  flex: 1;
  padding: 0.2rem;
}

input {
  width: 100%;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--accent);
  border-radius: 6px;
  outline: none;
  background: var(--bg-deep);
}
</style>
