import os from 'os';

export interface CpuTickSnapshot {
  idle: number;
  total: number;
}

export function sampleCpuTicks(): CpuTickSnapshot {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type as keyof typeof cpu.times];
    }
    idle += cpu.times.idle;
  }

  return { idle, total };
}

export function calculateCpuPercent(prev: CpuTickSnapshot, curr: CpuTickSnapshot): number {
  const totalDiff = curr.total - prev.total;
  const idleDiff = curr.idle - prev.idle;
  if (totalDiff <= 0) return 0;
  const usedDiff = totalDiff - idleDiff;
  const percent = (usedDiff / totalDiff) * 100;
  return Math.max(0, Math.min(100, percent));
}

export const calculateCpuUsage = calculateCpuPercent;

export function adjustDutyCycle(currentBusyMs: number, currentCpuPercent: number, targetPercent = 24): number {
  if (currentCpuPercent > 35) {
    return 0; // Emergency cool-off: give full CPU to bot
  }
  if (currentCpuPercent < targetPercent - 2) {
    return Math.min(currentBusyMs + 2, 45); // Step up, cap at 45ms per 100ms
  }
  if (currentCpuPercent > targetPercent + 2) {
    return Math.max(currentBusyMs - 3, 0); // Step down
  }
  return currentBusyMs;
}
