# 服务端会话记忆与 MCP 联网

> cc404喵 的后端上下文与外部信息感知方案。

## 1. 服务端会话记忆

### 原理

- 每用户持有一个 `sessionId`（UUID），前端保存在 `localStorage`（按 username 分 key）
- 对话消息写入 `server/data/sessions.json`（与 `users.json` 同目录，已在 `.gitignore`）
- 每次 `/api/chat/stream` 以 **服务端历史为权威**，不再依赖前端 `history` 数组

### API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sessions` | 创建/恢复会话，body: `{ sessionId? }` |
| GET | `/api/sessions/:id/messages` | 读取历史 |
| DELETE | `/api/sessions/:id` | 清空会话 |

### 配置

| 变量 | 默认 | 说明 |
|------|------|------|
| `MEMORY_TURN_LIMIT` | 12 | 保留最近 N 轮（每轮 user+assistant 各 1 条） |
| `MEMORY_MAX_SESSIONS_PER_USER` | 5 | 每用户最多保留会话数，超出删最旧 |

---

## 2. Tavily MCP（本地 SSE）

### 启动

```bash
# 在 .env 中配置 TAVILY_API_KEY 与 MCP_SSE_URL
npm run dev:mcp          # 仅 MCP（Docker）
npm run dev:all          # server + client + MCP 一起启动
```

Docker 镜像默认：`acuvity/mcp-server-tavily:0.2.12`，SSE 端点 `http://localhost:8000/sse`。

### 配置

```env
TAVILY_API_KEY=tvly-your-key
MCP_ENABLED=true
MCP_SSE_URL=http://localhost:8000/sse
```

MCP 未连接时，Skill 自动降级为内置 Bing RSS / wttr.in 等，不阻塞对话。

### MCP 工具

| 工具 | Skill | 说明 |
|------|-------|------|
| `tavily-search` | web_search | 联网搜索 |
| `tavily-extract` | url_extract | 网页正文提取 |

---

## 3. Skill 注册表

路径：[`server/src/skills/`](../server/src/skills/)

| Skill ID | 触发 | MCP / 降级 |
|----------|------|------------|
| `web_search` | 搜索、新闻、天气等 | MCP → Bing RSS / wttr.in |
| `url_extract` | URL 或「总结网页」 | MCP → fetch 降级 |
| `datetime` | 现在几点、星期几 | 内置 |

新增 Skill：在 `skills/` 下实现 `Skill` 接口，并在 [`index.ts`](../server/src/skills/index.ts) 中 `registerSkill()`。

---

## 4. 云端 TTS（CosyVoice）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/tts` | body: `{ text }` → 返回 mp3 音频 |
| GET | `/api/tts/config` | TTS 配置摘要 |

```env
TTS_ENABLED=true
TTS_MODEL=cosyvoice-v3-flash
TTS_VOICE=longanyang
TTS_FORMAT=mp3
```

前端 [`client/src/lib/voiceOutput/`](../client/src/lib/voiceOutput/) 在 SSE 流式回复时分句请求 TTS 并排队播放。

---

## 5. 状态栏字段

| 字段 | 含义 |
|------|------|
| `memoryHit` | 本轮使用了服务端已有历史 |
| `toolsUsed` | 如 `mcp:tavily-search`、`web_search:bing_rss`、`datetime:builtin` |
| `mcpConnected` | Tavily MCP SSE 已连接 |
| `ttsEnabled` | 云端 CosyVoice 可用 |

---

## 6. 测试

```bash
npm run dev:server
node scripts/test-memory-mcp.mjs
```

需配置 `OPENAI_API_KEY`；联网步骤在无 MCP 时使用 Bing RSS 降级。
