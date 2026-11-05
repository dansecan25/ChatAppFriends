import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import ChatView from '@/views/ChatView.vue';
import JoinView from '@/views/JoinView.vue';
import LoginView from '@/views/LoginView.vue';
import RecoverView from '@/views/RecoverView.vue';

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/recover', name: 'recover', component: RecoverView, meta: { public: true } },
    { path: '/join', name: 'join', component: JoinView },
    { path: '/channels/:channelId(\\d+)?', name: 'chat', component: ChatView },
    { path: '/dms/:dmId(\\d+)', name: 'dm', component: ChatView },
    { path: '/:pathMatch(.*)*', redirect: { name: 'chat' } },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.restoreSession();
  if (!auth.user) return to.meta.public ? true : { name: 'login' };
  if (to.meta.public) return { name: 'chat' };

  const servers = useServerStore();
  if (!servers.loaded) await servers.fetchServers();
  const hasNoServer = servers.servers.length === 0 && !auth.user.isOwner;
  if (hasNoServer && to.name !== 'join') return { name: 'join' };
  if (!hasNoServer && to.name === 'join') return { name: 'chat' };
  return true;
});
