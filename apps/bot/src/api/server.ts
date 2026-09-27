import fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { healthRoutes } from './routes/health';
import { leaderboardRoutes } from './routes/leaderboard';
import { wheelRoutes } from './routes/wheel';
import { registerWheelClient } from './websocket/wheelSocket';

export function buildFastifyServer() {
  const app = fastify({ logger: false });

  app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  });

  app.register(websocket);

  app.register(healthRoutes);
  app.register(leaderboardRoutes);
  app.register(wheelRoutes);

  app.register(async function (fastifyInstance) {
    fastifyInstance.get('/ws/wheel/:sessionId', { websocket: true }, (connection: any, req: any) => {
      const { sessionId } = req.params as { sessionId: string };
      const ws = connection?.socket ?? connection;
      registerWheelClient(sessionId, ws);
    });
  });

  return app;
}
