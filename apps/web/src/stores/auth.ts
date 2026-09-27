import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface AuthUser {
  id: string;
  username: string;
  avatar?: string;
  guildId?: string;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  const user = ref<AuthUser | null>(null);

  const isAuthenticated = computed(() => !!token.value);

  function setAuth(newToken: string, newUser: AuthUser) {
    token.value = newToken;
    user.value = newUser;
  }

  function clearAuth() {
    token.value = null;
    user.value = null;
  }

  return {
    token,
    user,
    isAuthenticated,
    setAuth,
    clearAuth
  };
});
