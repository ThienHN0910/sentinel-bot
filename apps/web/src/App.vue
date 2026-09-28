<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowUpRight, Radio } from 'lucide-vue-next';
import { getJson } from './api';
import { INSTALL_URL, SUPPORT_URL } from './seo';

const route = useRoute();
const isProduct = computed(() => route.path.startsWith('/dashboard') || route.path === '/wheel');
const health = ref<{ status: string; memory: { rssMb: number } } | null>(null);
const healthChecked = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;

async function refreshHealth() {
  try { health.value = await getJson('/api/health'); }
  catch { health.value = null; }
  finally { healthChecked.value = true; }
}

onMounted(() => {
  void refreshHealth();
  timer = setInterval(() => { void refreshHealth(); }, 30_000);
});
onUnmounted(() => { if (timer) clearInterval(timer); });
</script>

<template>
  <div class="site-shell">
    <a class="skip-link" href="#main-content">Bỏ qua điều hướng</a>
    <header class="site-header">
      <div class="site-container header-inner">
        <router-link to="/" class="brand" aria-label="Sentinel Bot, trang chủ">
          <img src="/favicon.png" alt="" width="38" height="38" />
          <span>SENTINEL<span class="brand-dot">.</span></span>
        </router-link>
        <nav class="site-nav" aria-label="Điều hướng chính">
          <router-link to="/">Trang chủ</router-link>
          <router-link to="/commands">Lệnh &amp; cài đặt</router-link>
          <router-link to="/dashboard">Dashboard</router-link>
          <router-link to="/dashboard/rankings">Xếp hạng</router-link>
        </nav>
        <a class="header-cta" :href="INSTALL_URL" target="_blank" rel="noopener noreferrer">Thêm vào Discord <ArrowUpRight :size="16" /></a>
      </div>
    </header>

    <main id="main-content" :class="isProduct ? 'product-main' : ''">
      <router-view />
    </main>

    <footer class="site-footer">
      <div class="site-container footer-inner">
        <div>
          <router-link to="/" class="footer-brand">SENTINEL<span class="brand-dot">.</span></router-link>
          <p>Tiện ích cộng đồng Discord. Được vận hành độc lập, không liên kết với Discord.</p>
        </div>
        <div class="footer-links">
          <router-link to="/commands">Hướng dẫn &amp; lệnh</router-link>
          <router-link to="/privacy">Quyền riêng tư</router-link>
          <router-link to="/terms">Điều khoản</router-link>
          <a :href="SUPPORT_URL" target="_blank" rel="noopener noreferrer">Hỗ trợ</a>
        </div>
        <div class="footer-status"><Radio :size="14" /> API {{ health?.status === 'ok' ? 'đang hoạt động' : healthChecked ? 'chưa kết nối' : 'đang kiểm tra' }}</div>
      </div>
    </footer>
  </div>
</template>
