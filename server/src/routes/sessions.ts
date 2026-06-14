import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  clearSession,
  getMessages,
  getOrCreateSession,
} from '../services/conversationMemory.js';

export const sessionsRouter = Router();

sessionsRouter.post('/sessions', authMiddleware, (req, res) => {
  try {
    const { sessionId } = req.body as { sessionId?: string };
    const user = req.user!;
    const result = getOrCreateSession(user.userId, user.username, sessionId);
    const messages = getMessages(result.sessionId, user.userId);
    res.json({
      sessionId: result.sessionId,
      messages: messages.map(({ role, content }) => ({ role, content })),
      memoryHit: messages.length > 0,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : '会话创建失败' });
  }
});

sessionsRouter.get('/sessions/:id/messages', authMiddleware, (req, res) => {
  try {
    const user = req.user!;
    const id = String(req.params.id);
    const messages = getMessages(id, user.userId);
    res.json({
      sessionId: id,
      messages: messages.map(({ role, content }) => ({ role, content })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '读取失败';
    res.status(msg.includes('无权') ? 403 : 404).json({ error: msg });
  }
});

sessionsRouter.delete('/sessions/:id', authMiddleware, (req, res) => {
  try {
    clearSession(String(req.params.id), req.user!.userId);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '删除失败';
    res.status(msg.includes('无权') ? 403 : 404).json({ error: msg });
  }
});
