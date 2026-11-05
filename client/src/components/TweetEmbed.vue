<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const X_ORIGIN = 'https://platform.twitter.com';

const props = defineProps<{ postId: string }>();
const emit = defineEmits<{ loaded: [] }>();

const frame = ref<HTMLIFrameElement>();
const height = ref(260);

const source = computed(() => `${X_ORIGIN}/embed/Tweet.html?id=${props.postId}&theme=dark&dnt=true`);

/** X's player reports its height, which only it knows. */
function onMessage(event: MessageEvent): void {
  if (event.origin !== X_ORIGIN || event.source !== frame.value?.contentWindow) return;
  let data = event.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return;
    }
  }
  const embed = data?.['twttr.embed'];
  const reported = embed?.method === 'twttr.private.resize' ? Number(embed.params?.[0]?.height) : NaN;
  if (reported > 0) {
    height.value = Math.ceil(reported);
    emit('loaded');
  }
}

onMounted(() => window.addEventListener('message', onMessage));
onBeforeUnmount(() => window.removeEventListener('message', onMessage));
</script>

<template>
  <iframe
    ref="frame"
    class="post"
    :src="source"
    :style="{ height: `${height}px` }"
    title="Post on X"
    loading="lazy"
    scrolling="no"
    sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
    allowfullscreen
    referrerpolicy="strict-origin-when-cross-origin"
  />
</template>

<style scoped>
.post {
  display: block;
  width: min(550px, 100%);
  border: none;
  border-radius: 12px;
  color-scheme: normal;
}
</style>
