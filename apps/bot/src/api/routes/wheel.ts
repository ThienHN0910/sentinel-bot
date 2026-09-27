import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { WheelSessionModel } from '../../models/WheelSession';
import { broadcastWheelEvent } from '../websocket/wheelSocket';

export async function wheelRoutes(app: FastifyInstance) {
  app.get('/api/wheel/:sessionId', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const session = await WheelSessionModel.findOne({ sessionId }).lean();
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    return session;
  });

  app.post('/api/wheel/:sessionId/spin', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const session = await WheelSessionModel.findOne({ sessionId });
    if (!session || !session.items || session.items.length === 0) {
      return reply.status(400).send({ error: 'Invalid session or empty items' });
    }
    if (session.isCompleted) {
      return reply.status(409).send({ error: 'Session already completed', winner: session.winner });
    }

    const targetIndex = Math.floor(Math.random() * session.items.length);
    const winner = session.items[targetIndex].label;
    const durationMs = 6000;
    const targetAngle = 360 * 5 + (360 / session.items.length) * targetIndex;

    session.winner = winner;
    session.isCompleted = true;
    await session.save();

    broadcastWheelEvent(sessionId, {
      event: 'SPIN_START',
      targetIndex,
      targetAngle,
      durationMs,
      startedAt: Date.now()
    });

    setTimeout(() => {
      broadcastWheelEvent(sessionId, {
        event: 'SPIN_END',
        winner,
        targetIndex
      });
    }, durationMs);

    return { targetIndex, winner, durationMs };
  });
}
