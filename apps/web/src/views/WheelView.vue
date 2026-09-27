<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import Wheel3D, { type WheelItem } from '../components/Wheel3D.vue';
import { getJson, postJson } from '../api';
import { useWheelSocket } from '../composables/useWheelSocket';
import { usePageSeo } from '../seo';

usePageSeo('Vòng quay | Sentinel Bot', 'Vòng quay Discord của Sentinel Bot.', '/wheel', false);

interface WheelSession {
  sessionId: string;
  title: string;
  items: WheelItem[];
  isCompleted: boolean;
  winner?: string;
}

const route = useRoute();
const sessionId = typeof route.query.session === 'string' ? route.query.session : '';
const session = ref<WheelSession | null>(null);
const wheel = ref<InstanceType<typeof Wheel3D> | null>(null);
const loading = ref(true);
const spinning = ref(false);
const error = ref('');
const result = ref('');
const canSpin = computed(() => Boolean(session.value && !session.value.isCompleted && !spinning.value));

function startSpin(data: { targetIndex: number; winner: string; durationMs: number }) {
  if (!session.value || session.value.isCompleted) return;
  spinning.value = true;
  wheel.value?.spinToIndex(data.targetIndex, data.durationMs, data.winner);
}

useWheelSocket(sessionId, startSpin, (data) => {
  if (data.winner) result.value = data.winner;
});

async function spin() {
  if (!canSpin.value || !session.value) return;
  spinning.value = true;
  error.value = '';
  try {
    const data = await postJson<{ targetIndex: number; winner: string; durationMs: number }>(`/api/wheel/${encodeURIComponent(session.value.sessionId)}/spin`);
    wheel.value?.spinToIndex(data.targetIndex, data.durationMs, data.winner);
  } catch (cause) {
    spinning.value = false;
    error.value = cause instanceof Error ? cause.message : 'Không thể quay lúc này.';
  }
}

function finishSpin(payload: { winner: string }) {
  spinning.value = false;
  result.value = payload.winner;
  if (session.value) session.value.isCompleted = true;
}

onMounted(async () => {
  if (!sessionId) {
    error.value = 'Thiếu mã phiên vòng quay. Hãy mở liên kết bot gửi trong Discord.';
    loading.value = false;
    return;
  }
  try {
    session.value = await getJson<WheelSession>(`/api/wheel/${encodeURIComponent(sessionId)}`);
    result.value = session.value.winner ?? '';
  } catch {
    error.value = 'Phiên vòng quay không tồn tại hoặc đã hết hạn.';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="site-container wheel-page">
    <div class="page-intro"><p class="eyebrow">MINI GAME / VÒNG QUAY</p><h1>Để vòng quay<br /><span>quyết định.</span></h1><p>Phiên được tạo bởi lệnh <code>/random</code> trong Discord.</p></div>
    <p v-if="loading" class="state-message">Đang tải phiên vòng quay…</p>
    <p v-else-if="error" role="alert" class="state-message">{{ error }}</p>
    <div v-else-if="session" class="wheel-layout">
      <Wheel3D ref="wheel" :items="session.items" @spin-end="finishSpin" />
      <div class="wheel-controls"><p class="eyebrow">{{ session.title }}</p><h2>{{ result ? `Kết quả: ${result}` : 'Sẵn sàng quay?' }}</h2><p>Chỉ một kết quả được lưu cho mỗi phiên. Mọi người dùng cùng liên kết sẽ thấy kết quả đó.</p><button class="button-primary" type="button" :disabled="!canSpin" @click="spin">{{ spinning ? 'Đang quay…' : session.isCompleted ? 'Đã hoàn tất' : 'Quay vòng quay' }}</button></div>
    </div>
  </div>
</template>
