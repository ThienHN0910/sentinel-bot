import fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { healthRoutes } from './routes/health';
import { leaderboardRoutes } from './routes/leaderboard';
import { wheelRoutes } from './routes/wheel';
import { registerWheelClient } from './websocket/wheelSocket';
import type { Client } from 'discord.js';
import { dashboardRoutes } from './routes/dashboard';
import { rankingRoutes } from './routes/rankings';
import type { GovernorManager } from '../governor/GovernorManager';

export function buildFastifyServer(client?: Client, governor?: GovernorManager) {
  const app = fastify({ logger: false });

  app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  });

  app.register(websocket);

  app.register((instance) => healthRoutes(instance, governor));
  app.register(leaderboardRoutes);
  app.register((instance) => dashboardRoutes(instance, client));
  app.register((instance) => rankingRoutes(instance, client));
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
