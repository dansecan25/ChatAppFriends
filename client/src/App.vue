<script setup lang="ts">
import RecoveryKeyDialog from '@/components/RecoveryKeyDialog.vue';
import { useAuthStore } from '@/stores/authStore';

const auth = useAuthStore();
</script>

<template>
  <RouterView />
  <RecoveryKeyDialog v-if="auth.pendingRecoveryCode" />
</template>
