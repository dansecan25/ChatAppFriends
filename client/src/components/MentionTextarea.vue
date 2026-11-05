<script setup lang="ts">
import { ref, toRef } from 'vue';
import { useMentionPicker } from '@/composables/useMentionPicker';
import type { Thread } from '@/services/crypto/keyring';

defineOptions({ inheritAttrs: false });

const props = defineProps<{ thread: Thread }>();
const emit = defineEmits<{ submit: []; cancel: [] }>();
const text = defineModel<string>({ required: true });

const textarea = ref<HTMLTextAreaElement>();
const picker = useMentionPicker(toRef(props, 'thread'), text, textarea);

/** Enter submits and Escape cancels, unless the suggestions list is using the key. */
function onKeydown(event: KeyboardEvent): void {
  if (picker.onKeydown(event) || event.isComposing) return;
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    emit('submit');
  } else if (event.key === 'Escape') {
    emit('cancel');
  }
}

defineExpose({
  encode: picker.encode,
  decode: picker.decode,
  close: picker.close,
  focus: () => textarea.value?.focus(),
});
</script>

<template>
  <ul v-if="picker.options.value.length" class="mentions" role="listbox" aria-label="Mention suggestions">
    <li v-for="(option, index) in picker.options.value" :key="option.key" role="option" :aria-selected="index === picker.selected.value">
      <button type="button" :class="{ selected: index === picker.selected.value }" @mousedown.prevent @click="picker.choose(option)">
        <span class="label">{{ option.label }}</span>
        <span v-if="option.detail" class="detail">{{ option.detail }}</span>
      </button>
    </li>
  </ul>
  <textarea
    ref="textarea"
    v-model="text"
    v-bind="$attrs"
    rows="1"
    maxlength="4000"
    @keydown="onKeydown"
    @input="picker.sync"
    @click="picker.sync"
    @keyup.left="picker.sync"
    @keyup.right="picker.sync"
    @blur="picker.close"
  />
</template>

<style scoped>
textarea {
  flex: 1;
  min-width: 0;
  max-height: 160px;
  padding: 0.38rem 0.25rem;
  border: none;
  outline: none;
  background: none;
  field-sizing: content;
  resize: none;
}

textarea::placeholder {
  color: var(--text-faint);
}

.mentions {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.35rem);
  left: 0;
  z-index: 5;
  overflow: hidden;
  margin: 0;
  padding: 0.25rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-raised);
  list-style: none;
}

.mentions button {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  width: 100%;
  padding: 0.4rem 0.55rem;
  border: none;
  border-radius: 6px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.mentions button.selected,
.mentions button:hover {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}

.mentions .label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mentions .detail {
  color: var(--text-faint);
  font-size: 0.78rem;
}
</style>
