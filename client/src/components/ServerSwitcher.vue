<script setup lang="ts">
import { useServerStore } from '@/stores/serverStore';

const servers = useServerStore();
</script>

<template>
  <div class="switcher" role="tablist" aria-label="Servers">
    <button
      v-for="server in servers.servers"
      :key="server.id"
      role="tab"
      class="tab"
      :class="{ active: server.id === servers.activeId }"
      :aria-selected="server.id === servers.activeId"
      :title="server.name"
      @click="servers.select(server.id)"
    >
      {{ server.name.slice(0, 2).toUpperCase() }}
    </button>
  </div>
</template>

<style scoped>
.switcher {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-deep);
}

.tab {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--bg-raised);
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 700;
}

.tab:hover,
.tab.active {
  background: var(--accent);
  color: var(--on-accent);
}
</style>
