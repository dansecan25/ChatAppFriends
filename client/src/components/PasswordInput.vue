<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from './AppIcon.vue';

defineOptions({ inheritAttrs: false });

const value = defineModel<string>({ required: true });
const visible = ref(false);
</script>

<template>
  <span class="password">
    <input v-bind="$attrs" v-model="value" :type="visible ? 'text' : 'password'" />
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
