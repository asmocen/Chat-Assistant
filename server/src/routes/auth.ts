import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createUser, findUserByUsername } from '../db.js';
import { authMiddleware, signToken } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username?.trim() || !password) {
    return res.status(400).json({ error: '请填写用户名和密码' });
  }

  const name = username.trim();
  if (name.length < 2 || name.length > 20) {
    return res.status(400).json({ error: '用户名长度应为 2–20 个字符' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少 6 位' });
  }

  if (findUserByUsername(name)) {
    return res.status(409).json({ error: '用户名已被注册' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = createUser(name, passwordHash);
  const token = signToken({ userId: user.id, username: user.username });

  res.status(201).json({ token, username: user.username });
});

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username?.trim() || !password) {
    return res.status(400).json({ error: '请填写用户名和密码' });
  }

  const user = findUserByUsername(username.trim());
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = signToken({ userId: user.id, username: user.username });
  res.json({ token, username: user.username });
});

authRouter.get('/me', authMiddleware, (req, res) => {
  res.json({ username: req.user!.username, userId: req.user!.userId });
});
