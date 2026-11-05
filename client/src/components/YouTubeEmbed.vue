<script setup lang="ts">
import { computed, ref } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ videoId: string; start: number }>();
defineEmits<{ loaded: [] }>();

/** The player only loads when asked, so a chat full of links stays light. */
const playing = ref(false);

const thumbnail = computed(() => `https://i.ytimg.com/vi/${props.videoId}/hqdefault.jpg`);
const player = computed(
  () => `https://www.youtube-nocookie.com/embed/${props.videoId}?autoplay=1&rel=0&start=${props.start}`,
);
</script>

<template>
  <div class="video">
    <iframe
      v-if="playing"
      :src="player"
      title="YouTube video"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
    />
    <button v-else class="poster" aria-label="Play YouTube video" @click="playing = true">
      <img :src="thumbnail" alt="" loading="lazy" referrerpolicy="no-referrer" @load="$emit('loaded')" />
      <span class="play"><AppIcon name="play" :size="26" /></span>
    </button>
  </div>
</template>

<style scoped>
.video {
  width: min(480px, 100%);
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 10px;
  background: #000;
}

iframe,
.poster,
.poster img {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
}

.poster {
  position: relative;
  padding: 0;
  background: none;
  cursor: pointer;
}

.poster img {
  object-fit: cover;
}

.play {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  place-items: center;
  width: 64px;
  height: 44px;
  border-radius: 12px;
  background: rgb(0 0 0 / 70%);
  color: #fff;
  transform: translate(-50%, -50%);
}

.poster:hover .play,
.poster:focus-visible .play {
  background: #e00;
}
</style>
