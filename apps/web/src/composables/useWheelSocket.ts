import { ref, onMounted, onUnmounted } from 'vue';
import { WheelSocketEvent } from '@sentinel/shared';

export function useWheelSocket(
  sessionId: string,
  onSpinStart: (data: any) => void,
  onSpinEnd: (data: any) => void
) {
  const ws = ref<WebSocket | null>(null);

  onMounted(() => {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
    const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:3000'}/ws/wheel/${sessionId}`;
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
