import { describe, it, expect } from 'vitest';
import { calculateCpuPercent, adjustDutyCycle, sampleCpuTicks, calculateCpuUsage } from '../src/governor/metrics';
import { GovernorManager, governorManager } from '../src/governor/GovernorManager';

describe('Adaptive CPU Governor Math & Metrics', () => {
  it('calculates CPU percentage from two tick snapshots accurately', () => {
    const prev = { idle: 1000, total: 2000 };
    const curr = { idle: 1600, total: 3000 };
    // totalDiff = 1000, idleDiff = 600, usedDiff = 400 => 40%
    const usage = calculateCpuPercent(prev, curr);
    expect(usage).toBeCloseTo(40, 1);
  });

  it('provides calculateCpuUsage alias identical to calculateCpuPercent', () => {
    const prev = { idle: 1000, total: 2000 };
    const curr = { idle: 1600, total: 3000 };
    expect(calculateCpuUsage(prev, curr)).toBeCloseTo(40, 1);
  });

  it('samples cpu ticks from host with non-zero values', () => {
    const sample = sampleCpuTicks();
    expect(sample.idle).toBeGreaterThan(0);
    expect(sample.total).toBeGreaterThan(0);
    expect(sample.total).toBeGreaterThanOrEqual(sample.idle);
  });

  it('increases duty cycle when host CPU is below target 24%', () => {
    const currentBusyMs = 20;
    const adjusted = adjustDutyCycle(currentBusyMs, 18, 24);
    expect(adjusted).toBeGreaterThan(currentBusyMs);
    expect(adjusted).toBe(22);
  });

  it('decreases duty cycle when host CPU is above target 26%', () => {
    const currentBusyMs = 30;
    const adjusted = adjustDutyCycle(currentBusyMs, 32, 24);
    expect(adjusted).toBeLessThan(currentBusyMs);
    expect(adjusted).toBe(27);
  });

  it('leaves duty cycle unchanged when host CPU is within target range [22%, 26%]', () => {
    const currentBusyMs = 24;
    expect(adjustDutyCycle(currentBusyMs, 23, 24)).toBe(currentBusyMs);
    expect(adjustDutyCycle(currentBusyMs, 25, 24)).toBe(currentBusyMs);
  });

  it('drops duty cycle to 0 when host CPU exceeds safety threshold of 35%', () => {
    const currentBusyMs = 25;
    const adjusted = adjustDutyCycle(currentBusyMs, 38, 24);
    expect(adjusted).toBe(0);
  });

  it('caps duty cycle at 45ms maximum', () => {
    const currentBusyMs = 44;
    const adjusted = adjustDutyCycle(currentBusyMs, 10, 24);
    expect(adjusted).toBe(45);
  });

  it('handles zero or negative total ticks gracefully in calculateCpuPercent', () => {
    const prev = { idle: 1000, total: 2000 };
    const curr = { idle: 1000, total: 2000 };
    expect(calculateCpuPercent(prev, curr)).toBe(0);
  });

  it('clamps CPU percent between 0 and 100 on abnormal virtualization ticks', () => {
    const prev = { idle: 1000, total: 2000 };
    // idleDiff (1200) > totalDiff (1000) => negative percent clamped to 0
    const currNegative = { idle: 2200, total: 3000 };
    expect(calculateCpuPercent(prev, currNegative)).toBe(0);

    // idleDiff (-100) => usedDiff (1100) > totalDiff (1000) => clamped to 100
    const currOverflow = { idle: 900, total: 3000 };
    expect(calculateCpuPercent(prev, currOverflow)).toBe(100);
  });

  it('handles 32-bit counter overflow cleanly without throwing RangeError', () => {
    let burnCounter = 0xffffffff;
    const burnBuffer = Buffer.alloc(32);
    // Wrap to 0 using unsigned right shift
    burnCounter = (burnCounter + 1) >>> 0;
    expect(burnCounter).toBe(0);
    expect(() => burnBuffer.writeUInt32BE(burnCounter, 0)).not.toThrow();
  });
});

describe('GovernorManager', () => {
  it('exposes default telemetry with getTelemetry and getMetrics', () => {
    const manager = new GovernorManager();
    const telemetry = manager.getTelemetry();
    expect(telemetry.busyMs).toBe(24);
    expect(telemetry.cpuPercent).toBe(0);
    expect(manager.getMetrics()).toEqual(telemetry);
  });

  it('stops cleanly when no worker is running', () => {
    const manager = new GovernorManager();
    expect(() => manager.stop()).not.toThrow();
  });

  it('starts worker thread, receives telemetry, and stops cleanly', async () => {
    const manager = new GovernorManager();
    expect(manager.getWorker()).toBeNull();

    manager.start();
    const worker = manager.getWorker();
    expect(worker).not.toBeNull();

    // Wait for the worker to send the initial telemetry message
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for telemetry')), 4000);
      const check = setInterval(() => {
        const telemetry = manager.getTelemetry();
        if (telemetry.memoryRssMb > 0) {
          clearTimeout(timeout);
          clearInterval(check);
          resolve();
        }
      }, 50);
    });

    const telemetry = manager.getTelemetry();
    expect(telemetry.memoryRssMb).toBeGreaterThan(0);
    expect(telemetry.busyMs).toBe(24);

    manager.stop();
    expect(manager.getWorker()).toBeNull();
  });
});
