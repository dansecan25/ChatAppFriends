<script setup lang="ts">
const paths = {
  hash: 'M5 9h14M5 15h14M10 3 8 21M16 3l-2 18',
  speaker: 'M4 9.5v5h4l5 4v-13l-5 4H4ZM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM6 11a6 6 0 0 0 12 0M12 17v4',
  micOff: 'M3 3l18 18M9 9v3a3 3 0 0 0 4.5 2.6M15 11V6a3 3 0 0 0-5.7-1.3M6 11a6 6 0 0 0 9.3 5M18 11a6 6 0 0 1-.4 2.2M12 17v4',
  headphones: 'M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H4zM17 15h3v5h-3z',
  headphonesOff: 'M3 3l18 18M4 15v-3a8 8 0 0 1 1.5-4.7M8.6 4.8A8 8 0 0 1 20 12v3M4 15h3v5H4zM17 15h3v5h-3z',
  hangup: 'M3 15c5-5 13-5 18 0l-2.5 3-3.5-2v-2.5a9 9 0 0 0-6 0V16l-3.5 2z',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15 9.5a1 1 0 1 0 0-.01',
  send: 'M4 12 20 4l-5 16-3-7z',
  close: 'M6 6l12 12M18 6 6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
} as const;

defineProps<{ name: keyof typeof paths; size?: number }>();
</script>

<template>
  <svg
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name]" />
  </svg>
</template>
