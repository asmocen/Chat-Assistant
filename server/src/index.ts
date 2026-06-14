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
import { sessionsRouter } from './routes/sessions.js';
import { ttsRouter } from './routes/tts.js';
import { getMemoryConfig } from './services/conversationMemory.js';
import { getMcpConnectionStatus, isMcpConfigured } from './services/mcpClient.js';
import { isOpenAiApiKeyConfigured } from './services/apiKey.js';
import { isQiniuConfigured } from './services/qiniu.js';
import { getTtsConfig, isTtsEnabled } from './services/tts.js';
import { isWebSearchSkillEnabled } from './skills/index.js';

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

const ttsLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.TTS_MAX_REQUESTS_PER_MINUTE) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '语音合成请求过于频繁，请稍后再试' },
});

app.use('/api/auth', authRouter);
app.use('/api/chat', limiter);
app.use('/api/tts', ttsLimiter);
app.use('/api', sessionsRouter);
app.use('/api', chatRouter);
app.use('/api', chatStreamRouter);
app.use('/api', ttsRouter);

app.get('/api/health', async (_req, res) => {
  const memory = getMemoryConfig();
  const mcp = await getMcpConnectionStatus();
  const ttsCfg = getTtsConfig();
  res.json({
    status: 'ok',
    model: process.env.OPENAI_MODEL || 'qwen-vl-plus',
    hasApiKey: isOpenAiApiKeyConfigured(),
    qiniuConfigured: isQiniuConfigured(),
    memoryEnabled: true,
    memoryTurnLimit: memory.turnLimit,
    mcpConfigured: isMcpConfigured(),
    mcpConnected: mcp.connected,
    mcpTools: mcp.tools,
    mcpToolDetails: mcp.toolDetails,
    mcpError: mcp.error,
    webSearchEnabled: isWebSearchSkillEnabled(),
    webSearchProvider: process.env.WEB_SEARCH_PROVIDER || 'bing_rss',
    ttsEnabled: isTtsEnabled(),
    ttsModel: ttsCfg.model,
    ttsVoice: ttsCfg.voice,
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(
    `LLM: ${process.env.OPENAI_MODEL || 'qwen-vl-plus'}, API Key: ${isOpenAiApiKeyConfigured() ? '已配置' : '未配置（请在 .env 填入 DashScope API Key）'}`,
  );
});
