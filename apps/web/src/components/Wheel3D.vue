<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import confetti from 'canvas-confetti';
import { useSoundEffect } from '../composables/useSoundEffect';

export interface WheelItem {
  id: string;
  label: string;
  color: string;
  weight?: number;
}

const props = defineProps<{
  items: WheelItem[];
  isSpinning?: boolean;
}>();

const emit = defineEmits<{
  (e: 'spin-end', payload: { winner: string; targetIndex: number }): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const currentAngle = ref(0);
const isFlapperKicking = ref(false);
const isSpinningInternal = ref(false);

const { playTick } = useSoundEffect();

let animId: number | null = null;
let flapperTimer: ReturnType<typeof setTimeout> | null = null;
let lastPegIndex = -1;

export function calculateSliceAngle(totalSlices: number): number {
  if (totalSlices <= 0) return 0;
  return (2 * Math.PI) / totalSlices;
}

function checkPegCollision(angle: number) {
  if (props.items.length === 0) return;
  const sliceAngle = calculateSliceAngle(props.items.length);
  // Flapper pointer is at 12 o'clock (1.5 * Math.PI)
  let norm = (1.5 * Math.PI - angle) % (2 * Math.PI);
  if (norm < 0) norm += 2 * Math.PI;
  const pegIndex = Math.floor(norm / sliceAngle);

  if (lastPegIndex !== -1 && pegIndex !== lastPegIndex) {
    playTick();
    isFlapperKicking.value = true;
    if (flapperTimer) clearTimeout(flapperTimer);
    flapperTimer = setTimeout(() => {
      isFlapperKicking.value = false;
    }, 60);
  }
  lastPegIndex = pegIndex;
}

function triggerCelebration() {
  try {
    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00F2FE', '#7F00FF', '#FF007F', '#00FF88', '#FFFFFF']
    });
  } catch {
    // Canvas confetti gracefully falls back in non-browser envs
  }
}

function drawWheel() {
  const canvas = canvasRef.value;
  if (!canvas || props.items.length === 0) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const size = 440;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);

  const center = size / 2;
  const radius = center - 20;
  const sliceAngle = calculateSliceAngle(props.items.length);

  ctx.clearRect(0, 0, size, size);

  // Slices
  props.items.forEach((item, i) => {
    const start = currentAngle.value + i * sliceAngle;
    const end = start + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    // Labels
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(start + sliceAngle / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(item.label, radius - 24, 5);
    ctx.restore();
  });

  // Perimeter Divider Pegs
  props.items.forEach((_, i) => {
    const pegAngle = currentAngle.value + i * sliceAngle;
    const pegX = center + (radius - 6) * Math.cos(pegAngle);
    const pegY = center + (radius - 6) * Math.sin(pegAngle);

    ctx.beginPath();
    ctx.arc(pegX, pegY, 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#00F2FE';
    ctx.stroke();
  });

  // Outer Neon Glow Ring for Center Hub
  ctx.beginPath();
  ctx.arc(center, center, 42, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(0, 242, 254, 0.12)';
  ctx.fill();

  // Metallic Center Hub Base
  ctx.beginPath();
  ctx.arc(center, center, 35, 0, 2 * Math.PI);
  ctx.fillStyle = '#0a0b10';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#00F2FE';
  ctx.stroke();

  // Inner Metallic Rivet
  ctx.beginPath();
  ctx.arc(center, center, 14, 0, 2 * Math.PI);
  const rivetGrad = ctx.createRadialGradient(center - 3, center - 3, 2, center, center, 14);
  rivetGrad.addColorStop(0, '#94a3b8');
  rivetGrad.addColorStop(0.7, '#334155');
  rivetGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = rivetGrad;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.stroke();
}

function spinToIndex(targetIndex: number, durationMs = 4500, winnerName?: string) {
  if (props.items.length === 0 || isSpinningInternal.value) return;
  isSpinningInternal.value = true;

  const sliceAngle = calculateSliceAngle(props.items.length);
  const fullTurns = Math.max(5, Math.ceil(currentAngle.value / (2 * Math.PI)) + 5);
  const targetAngle = 1.5 * Math.PI + 2 * Math.PI * fullTurns - (targetIndex + 0.5) * sliceAngle;
  const startAngle = currentAngle.value;
  const deltaAngle = targetAngle - startAngle;
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  function step(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    // Cubic decelerating physics curve
    const ease = 1 - Math.pow(1 - progress, 3);
    currentAngle.value = startAngle + deltaAngle * ease;
    checkPegCollision(currentAngle.value);
    drawWheel();

    if (progress < 1) {
      animId = requestAnimationFrame(step);
    } else {
      isSpinningInternal.value = false;
      const winner = winnerName || props.items[targetIndex]?.label || '';
      triggerCelebration();
      emit('spin-end', { winner, targetIndex });
    }
  }

  animId = requestAnimationFrame(step);
}

function spin(targetIndex?: number, durationMs = 4500, winnerName?: string) {
  if (props.items.length === 0) return;
  const index = typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < props.items.length
    ? targetIndex
    : Math.floor(Math.random() * props.items.length);
  spinToIndex(index, durationMs, winnerName);
}

onMounted(() => {
  drawWheel();
});

onUnmounted(() => {
  if (animId !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(animId);
  }
  if (flapperTimer) {
    clearTimeout(flapperTimer);
  }
});

watch(
  () => props.items,
  () => drawWheel(),
  { deep: true }
);

watch(
  () => props.isSpinning,
  (spinning) => {
    if (spinning && !isSpinningInternal.value && props.items.length > 0) {
      spin();
    }
  }
);

defineExpose({
  currentAngle,
  drawWheel,
  spin,
  spinToIndex
});
</script>

<template>
  <div class="relative flex flex-col items-center justify-center p-6 glass-panel rounded-3xl">
    <!-- Spring-loaded Flapper Pointer (Hardware-accelerated transforms only) -->
    <div
      :class="[
        'absolute top-2 z-20 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[28px] border-t-cyan-400 drop-shadow-[0_4px_8px_rgba(0,242,254,0.6)] transform-gpu origin-top transition-transform',
        isFlapperKicking ? '-rotate-12 duration-75' : 'rotate-0 duration-150'
      ]"
    ></div>

    <canvas
      ref="canvasRef"
      class="w-[440px] h-[440px] drop-shadow-[0_12px_32px_rgba(0,0,0,0.6)]"
    ></canvas>
  </div>
</template>
