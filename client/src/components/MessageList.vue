<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { threadKeyOf, type Thread } from '@/services/crypto/keyring';
import { useAuthStore } from '@/stores/authStore';
import { useMessageStore } from '@/stores/messageStore';
import { errorMessage } from '@/utils/errors';
import MessageItem from './MessageItem.vue';

const STICK_TO_BOTTOM_PX = 120;
const LOAD_OLDER_PX = 100;
const GROUP_WINDOW_MS = 5 * 60 * 1000;

const props = defineProps<{ thread: Thread }>();

const auth = useAuthStore();
const store = useMessageStore();

const scroller = ref<HTMLElement>();
const loadingOlder = ref(false);
const olderError = ref<string | null>(null);

const state = computed(() => store.threadState(threadKeyOf(props.thread)));
const messages = computed(() => state.value.messages);

/** Tells whether a message continues the previous author's run. */
function isGrouped(index: number): boolean {
  const current = messages.value[index];
  const previous = messages.value[index - 1];
  return (
    !!previous &&
    previous.author.id === current.author.id &&
    current.createdAt.getTime() - previous.createdAt.getTime() < GROUP_WINDOW_MS
  );
}

const isNearBottom = () => {
  const el = scroller.value;
  return !!el && el.scrollHeight - el.scrollTop - el.clientHeight < STICK_TO_BOTTOM_PX;
};

const scrollToBottom = () => {
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
};

/** Loads earlier messages when scrolled to the top, keeping the view in place. */
async function onScroll(): Promise<void> {
  const el = scroller.value;
  if (!el || el.scrollTop > LOAD_OLDER_PX || loadingOlder.value || !state.value.hasMore || !state.value.loaded) return;
  loadingOlder.value = true;
  olderError.value = null;
  const previousHeight = el.scrollHeight;
  try {
    await store.loadOlder(props.thread);
    await nextTick();
    el.scrollTop += el.scrollHeight - previousHeight;
  } catch (err) {
    olderError.value = errorMessage(err, 'Could not load older messages');
  } finally {
    loadingOlder.value = false;
  }
}

/** Keeps the newest message visible as images finish loading. */
function onImageLoaded(): void {
  if (isNearBottom()) scrollToBottom();
}

watch(
  () => messages.value.at(-1)?.id,
  async () => {
    const shouldStick = isNearBottom() || messages.value.at(-1)?.author.id === auth.user?.id;
    await nextTick();
    if (shouldStick) scrollToBottom();
  },
);

watch(
  () => state.value.loaded,
  async () => {
    await nextTick();
    scrollToBottom();
  },
);

onMounted(scrollToBottom);
</script>

<template>
  <div ref="scroller" class="list" role="log" aria-live="polite" @scroll.passive="onScroll">
    <p v-if="olderError" class="form-error note">{{ olderError }}</p>
    <p v-else-if="loadingOlder" class="note">Loading older messages…</p>
    <div v-if="state.loaded && messages.length === 0" class="empty">
      <h2>Nothing here yet</h2>
      <p>Say hello or share an image to get things started. Only people here can read it.</p>
    </div>
    <MessageItem
      v-for="(message, index) in messages"
      :key="message.id"
      :message="message"
      :grouped="isGrouped(index)"
      @image-loaded="onImageLoaded"
    />
  </div>
</template>

<style scoped>
.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem 0;
}

.note {
  margin: 0.25rem;
  color: var(--text-faint);
  font-size: 0.85rem;
  text-align: center;
}

.empty {
  padding: 3rem 16px;
  color: var(--text-muted);
  text-align: center;
}

.empty h2 {
  margin: 0 0 0.25rem;
  color: var(--text);
  font-size: 1.2rem;
}

.empty p {
  margin: 0;
}
</style>
