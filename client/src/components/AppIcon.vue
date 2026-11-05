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
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-3.2 4M6.4 6.4A18 18 0 0 0 2 12s4 7 10 7a10 10 0 0 0 4.6-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
  unlock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 5.6-1.5',
  settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4h4V5zM6 15v4h4v-4z',
  dm: 'M4 5h16v11H9l-5 4z',
  pencil: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
  bell: 'M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4',
  bellOff: 'M3 3l18 18M8 6.5A6 6 0 0 1 18 11v4M6 11v6l-1.5 2H17M10 21h4',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c1.8.8 3 2.8 3 5.5',
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
