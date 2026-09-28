import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ApiError, getAuthMe, logoutSession } from '../api';

export interface AuthUser {
  id: string;
  username: string;
  avatar: string | null;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const csrfToken = ref<string | null>(null);
  const checked = ref(false);

  const isAuthenticated = computed(() => !!user.value && !!csrfToken.value);

  async function loadSession() {
    try {
      const response = await getAuthMe();
      user.value = response.user;
      csrfToken.value = response.csrfToken;
    } catch (error) {
      clearAuth();
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    } finally {
      checked.value = true;
    }
  }

  function clearAuth() {
    user.value = null;
    csrfToken.value = null;
  }

  async function logout() {
    if (csrfToken.value) await logoutSession(csrfToken.value);
    clearAuth();
  }

  return {
    user,
    csrfToken,
    checked,
    isAuthenticated,
    loadSession,
    logout,
    clearAuth
  };
});
