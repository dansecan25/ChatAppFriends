import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import ChatView from '@/views/ChatView.vue';
import LoginView from '@/views/LoginView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/channels/:channelId(\\d+)?', name: 'chat', component: ChatView },
    { path: '/:pathMatch(.*)*', redirect: { name: 'chat' } },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.restoreSession();
  if (!to.meta.public && !auth.user) return { name: 'login' };
  if (to.meta.public && auth.user) return { name: 'chat' };
  return true;
});
