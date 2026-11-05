<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';

defineOptions({ inheritAttrs: false });

const value = defineModel<string>({ required: true });
const visible = ref(false);
const input = ref<HTMLInputElement>();

/** Browsers only offer to save fields that are password fields when the form is sent. */
const hide = () => {
  visible.value = false;
};

onMounted(() => input.value?.form?.addEventListener('submit', hide, { capture: true }));
onBeforeUnmount(() => input.value?.form?.removeEventListener('submit', hide, { capture: true }));
</script>

<template>
  <span class="password">
    <input ref="input" v-bind="$attrs" v-model="value" name="password" :type="visible ? 'text' : 'password'" />
    <button
      type="button"
      class="icon-btn eye"
      :aria-label="visible ? 'Hide password' : 'Show password'"
      :title="visible ? 'Hide password' : 'Show password'"
      :aria-pressed="visible"
      @click="visible = !visible"
    >
      <AppIcon :name="visible ? 'eyeOff' : 'eye'" :size="18" />
    </button>
  </span>
</template>

<style scoped>
.password {
  position: relative;
  display: flex;
}

input {
  flex: 1;
  min-width: 0;
  padding-right: 2.75rem;
}

.eye {
  position: absolute;
  top: 50%;
  right: 0.25rem;
  transform: translateY(-50%);
}
</style>
