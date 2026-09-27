<script setup lang="ts">
import { ref, shallowRef, triggerRef, onMounted, onUnmounted, watch } from 'vue';

export interface CloudWord {
  text: string;
  weight: number; // 1–10, relative frequency
  color?: string;
}

const props = withDefaults(
  defineProps<{
    words: CloudWord[];
    radius?: number;
  }>(),
  {
    radius: 140
  }
);

// ─── Sphere Tag Cloud ──────────────────────────────────────────────────────────
interface Tag {
  word: CloudWord;
  x: number;
  y: number;
  z: number;
  fontSize: number;
  opacity: number;
}

const containerRef = ref<HTMLDivElement | null>(null);
const tags = shallowRef<Tag[]>([]);
const hoveredIdx = ref<number | null>(null);
const containerWidth = ref<number>(360);
const containerHeight = ref<number>(360);

let rotX = 0.003;
let rotY = 0.006;
const isDragging = ref(false);
let lastX = 0;
let lastY = 0;
let animId: number | null = null;
let resizeObserver: ResizeObserver | null = null;

function distributeOnSphere(words: CloudWord[]): Tag[] {
  const n = words.length;
  return words.map((word, i) => {
    // Fibonacci sphere point distribution (uniform on sphere surface)
    const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const r = props.radius;
    return {
      word,
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi),
      fontSize: 10 + (word.weight / 10) * 14,
      opacity: 0.7
    };
  });
}

function rotatePoint(tag: Tag, ax: number, ay: number) {
  // Rotate around X axis
  const cosX = Math.cos(ax);
  const sinX = Math.sin(ax);
  const y1 = tag.y * cosX - tag.z * sinX;
  const z1 = tag.y * sinX + tag.z * cosX;
  tag.y = y1;
  tag.z = z1;

  // Rotate around Y axis
  const cosY = Math.cos(ay);
  const sinY = Math.sin(ay);
  const x2 = tag.x * cosY + tag.z * sinY;
  const z2 = -tag.x * sinY + tag.z * cosY;
  tag.x = x2;
  tag.z = z2;
}

function applyDepth(tag: Tag) {
  const scale = (tag.z + props.radius) / (2 * props.radius);
  tag.opacity = 0.35 + scale * 0.65;
  tag.fontSize = (10 + (tag.word.weight / 10) * 14) * (0.6 + scale * 0.6);
}

function animate() {
  if (!isDragging.value) {
    for (const tag of tags.value) {
      rotatePoint(tag, rotX, rotY);
    }
  }
  for (const tag of tags.value) {
    applyDepth(tag);
  }
  // Sort by z depth for correct layering
  tags.value.sort((a, b) => a.z - b.z);
  triggerRef(tags);
  animId = requestAnimationFrame(animate);
}

// ─── Input handlers ─────────────────────────────────────────────────────────
function onMouseDown(e: MouseEvent) {
  isDragging.value = true;
  lastX = e.clientX;
  lastY = e.clientY;
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  rotY = dx * 0.003;
  rotX = dy * 0.003;
  lastX = e.clientX;
  lastY = e.clientY;
  for (const tag of tags.value) {
    rotatePoint(tag, rotX, rotY);
    applyDepth(tag);
  }
}

function onMouseUp() {
  isDragging.value = false;
  rotX = 0.003;
  rotY = 0.006;
}

onMounted(() => {
  tags.value = distributeOnSphere(props.words);
  animate();

  window.addEventListener('mouseup', onMouseUp);

  if (containerRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        containerWidth.value = entry.contentRect.width || 360;
        containerHeight.value = entry.contentRect.height || 360;
      }
    });
    resizeObserver.observe(containerRef.value);
    containerWidth.value = containerRef.value.clientWidth || 360;
    containerHeight.value = containerRef.value.clientHeight || 360;
  }
});

onUnmounted(() => {
  if (animId !== null) cancelAnimationFrame(animId);
  window.removeEventListener('mouseup', onMouseUp);
  resizeObserver?.disconnect();
});

watch(
  () => props.words,
  (newWords) => {
    tags.value = distributeOnSphere(newWords);
  },
  { deep: true }
);

function tagStyle(tag: Tag) {
  const cx = containerWidth.value / 2;
  const cy = containerHeight.value / 2;
  return {
    transform: `translate3d(${cx + tag.x}px, ${cy + tag.y}px, 0)`,
    opacity: tag.opacity,
    fontSize: `${tag.fontSize.toFixed(1)}px`,
    color: tag.word.color ?? '#00f2fe',
    transition: isDragging.value ? 'none' : 'opacity 0.3s'
  };
}
</script>

<template>
  <div class="glass-panel p-6 rounded-3xl select-none">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2.5">
        <div class="p-2 rounded-xl bg-violet-400/10 border border-violet-400/30">
          <span class="block w-3 h-3 rounded-full bg-violet-400" />
        </div>
        <div>
          <h3 class="text-base font-bold text-white tracking-wide">Word Cloud Cộng Đồng</h3>
          <p class="text-xs text-gray-400">3D spherical tag cloud — drag to rotate</p>
        </div>
      </div>
      <span class="text-xs font-mono px-2.5 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300">
        LIVE CLOUD
      </span>
    </div>

    <!-- Sphere container -->
    <div
      ref="containerRef"
      class="relative w-full h-72 overflow-hidden cursor-grab active:cursor-grabbing"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
    >
      <span
        v-for="(tag, idx) in tags"
        :key="tag.word.text"
        :style="tagStyle(tag)"
        :class="[
          'absolute -translate-x-1/2 -translate-y-1/2 font-bold whitespace-nowrap transform-gpu pointer-events-auto transition-[text-shadow]',
          hoveredIdx === idx ? 'drop-shadow-[0_0_8px_currentColor]' : ''
        ]"
        @mouseenter="hoveredIdx = idx"
        @mouseleave="hoveredIdx = null"
      >
        {{ tag.word.text }}
      </span>
    </div>
  </div>
</template>
