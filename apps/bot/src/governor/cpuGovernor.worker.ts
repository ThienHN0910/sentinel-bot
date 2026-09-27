import { parentPort } from 'worker_threads';
import crypto from 'crypto';
import { sampleCpuTicks, calculateCpuPercent, adjustDutyCycle } from './metrics';

let isRunning = true;
let busyMs = 24; // Initial 24ms per 100ms window
const WINDOW_MS = 100;

let lastSample = sampleCpuTicks();
let lastSampleTime = performance.now();

let burnCounter = 0;
const burnBuffer = Buffer.alloc(32);

function burnCpu(durationMs: number) {
  const start = performance.now();
  while (performance.now() - start < durationMs) {
    burnBuffer.writeUInt32BE(burnCounter++, 0);
    crypto.createHash('sha256').update(burnBuffer).digest();
  }
}

async function loop() {
  // Initial telemetry on startup
  parentPort?.postMessage({
    type: 'TELEMETRY',
    cpuPercent: 0,
    busyMs,
    memoryRssMb: Math.round(process.memoryUsage().rss / (1024 * 1024))
  });

  while (isRunning) {
    // 1. Feedback check every 5 seconds
    const now = performance.now();
    if (now - lastSampleTime >= 5000) {
      const currentSample = sampleCpuTicks();
      const currentCpu = calculateCpuPercent(lastSample, currentSample);
      busyMs = adjustDutyCycle(busyMs, currentCpu, 24);
      lastSample = currentSample;
      lastSampleTime = now;

      parentPort?.postMessage({
        type: 'TELEMETRY',
        cpuPercent: currentCpu,
        busyMs,
        memoryRssMb: Math.round(process.memoryUsage().rss / (1024 * 1024))
      });
    }

    // 2. Duty cycle execution
    if (busyMs > 0) {
      burnCpu(busyMs);
    }
    const sleepMs = Math.max(WINDOW_MS - busyMs, 5);
    await new Promise((resolve) => setTimeout(resolve, sleepMs));
  }
}

parentPort?.on('message', (msg) => {
  if (msg.type === 'STOP') {
    isRunning = false;
  }
});

loop();
