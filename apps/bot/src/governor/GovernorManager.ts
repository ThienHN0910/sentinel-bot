import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs';

export interface GovernorTelemetry {
  cpuPercent: number;
  busyMs: number;
  memoryRssMb: number;
  lastUpdated: Date;
}

export class GovernorManager {
  private worker: Worker | null = null;
  private latestTelemetry: GovernorTelemetry = {
    cpuPercent: 0,
    busyMs: 24,
    memoryRssMb: 0,
    lastUpdated: new Date()
  };

  public start(): void {
    if (this.worker) return;

    // Supports both tsx execution and compiled dist
    let workerPath = path.resolve(__dirname, 'cpuGovernor.worker.js');
    if (!fs.existsSync(workerPath)) {
      const tsPath = path.resolve(__dirname, 'cpuGovernor.worker.ts');
      if (fs.existsSync(tsPath)) {
        workerPath = tsPath;
      }
    }

    try {
      this.worker = new Worker(workerPath, {
        execArgv: workerPath.endsWith('.ts') ? ['--import', 'tsx'] : undefined,
      });
      this.worker.on('message', (msg) => {
        if (msg.type === 'TELEMETRY') {
          this.latestTelemetry = {
            cpuPercent: msg.cpuPercent,
            busyMs: msg.busyMs,
            memoryRssMb: msg.memoryRssMb,
            lastUpdated: new Date()
          };
        }
      });
      this.worker.on('error', (err) => console.error('Governor worker error:', err));
    } catch (e) {
      console.warn('Governor worker could not be started in current environment:', e);
    }
  }

  public stop(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'STOP' });
      this.worker.terminate();
      this.worker = null;
    }
  }

  public getTelemetry(): GovernorTelemetry {
    return this.latestTelemetry;
  }

  public getMetrics(): GovernorTelemetry {
    return this.latestTelemetry;
  }
}

export const governorManager = new GovernorManager();
