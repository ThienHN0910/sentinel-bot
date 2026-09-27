import { ref, onMounted, onUnmounted } from 'vue';
import { WheelSocketEvent } from '@sentinel/shared';
import { API_BASE_URL } from '../api';

export function useWheelSocket(
  sessionId: string,
  onSpinStart: (data: any) => void,
  onSpinEnd: (data: any) => void
) {
  const ws = ref<WebSocket | null>(null);

  onMounted(() => {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
    if (!sessionId) return;
    const wsBase = import.meta.env.VITE_WS_URL || API_BASE_URL.replace(/^http/, 'ws');
    const wsUrl = `${wsBase.replace(/\/$/, '')}/ws/wheel/${encodeURIComponent(sessionId)}`;
    ws.value = new WebSocket(wsUrl);

    ws.value.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as WheelSocketEvent;
        if (payload.event === 'SPIN_START') onSpinStart(payload);
        if (payload.event === 'SPIN_END') onSpinEnd(payload);
      } catch {}
    };
  });

  onUnmounted(() => {
    ws.value?.close();
  });

  return { ws };
}
