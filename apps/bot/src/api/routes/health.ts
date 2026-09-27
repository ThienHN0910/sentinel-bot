import { FastifyInstance } from 'fastify';
import { GovernorManager, governorManager } from '../../governor/GovernorManager';

export async function healthRoutes(app: FastifyInstance, governor: GovernorManager = governorManager) {
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024))
      },
      telemetry: governor.getTelemetry()
    };
  });
}
