import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../.env') });
import express from 'express';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth.js';
import { chatRouter } from './routes/chat.js';
import { chatStreamRouter } from './routes/chatStream.js';
import { isQiniuConfigured } from './services/qiniu.js';

const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.MAX_REQUESTS_PER_MINUTE) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试（成本控制限流）' },
});

app.use('/api/auth', authRouter);
app.use('/api/chat', limiter);
app.use('/api', chatRouter);
app.use('/api', chatStreamRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    model: process.env.OPENAI_MODEL || 'qwen-vl-plus',
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
    qiniuConfigured: isQiniuConfigured(),
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(
    `LLM: ${process.env.OPENAI_MODEL || 'qwen-vl-plus'}, API Key: ${process.env.OPENAI_API_KEY ? '已配置' : '未配置'}`,
  );
});
