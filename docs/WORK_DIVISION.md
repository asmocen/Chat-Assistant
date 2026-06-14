# AI 视觉对话助手 — 两人三天分工计划（V2 冲刺版）

> **登录方式**：用户名 + 密码（已确认）  
> **前提**：MVP 代码已存在于仓库  
> **目标**：三天交付 V2 全量（Auth + 七牛从 0 + Live2D + 流式 + 13/13 用户故事）  
> **文档**： [PRD.md](./PRD.md) | [CHARACTER.md](./CHARACTER.md) | [QINIU_SETUP.md](./QINIU_SETUP.md) | **[Day1 联调清单](./DAY1_INTEGRATION_CHECKLIST.md)**

---

## 分工总览

| 角色 | 职责 | 核心目录 |
|------|------|---------|
| **开发者 A** | 端侧：Auth UI、Live2D、媒体流、STT/TTS、流式 UI、直传 | `client/` |
| **开发者 B** | 云端：Auth API、七牛、语义缓存、SSE、STT、文档 | `server/`、`docs/` |

### 协作接口（Day 1 14:00 必须对齐）

```typescript
// Auth
POST /api/auth/register  { username, password }
POST /api/auth/login     { username, password }
// Header: Authorization: Bearer {token}

// Chat
POST /api/chat/stream {
  text: string;
  imageBase64?: string;
  imageKey?: string;
  history?: ChatMessage[];
  skipImage?: boolean;
}
// SSE events: meta | chunk | done | error

// Response meta
{ kodoHit, semanticHit, sentImage, imageUrl, usage }
```

---

## Day 1 — 基础设施日（8h × 2）

### 开发者 A

| 时段 | 任务 | 交付物 | h |
|------|------|--------|---|
| 09–11 | 安装 `react-router-dom`；Login/Register 页面 UI | `/login` `/register` 可访问 | 2 |
| 11–13 | AuthContext + JWT 存储 + ProtectedRoute | 未登录跳转登录 | 2 |
| 14–16 | ChatPage 从 App 拆出；登录欢迎语 | 登录后进对话页 | 2 |
| 16–18 | Live2D 组件挂载 idle/listening | cc404喵可见 | 2 |

**Day 1 验收（A）**
- [ ] 注册/登录/登出流程完整
- [ ] 未登录不能进对话页
- [ ] Live2D 至少显示 idle 态

### 开发者 B

| 时段 | 任务 | 交付物 | h |
|------|------|--------|---|
| 09–11 | **七牛注册+实名+建Bucket+CDN**（见 QINIU_SETUP） | `.env` 七牛四项 | 2 |
| 11–13 | SQLite + auth 路由 + JWT 中间件 | register/login 可用 | 2 |
| 14–16 | qiniu.ts + chat 改造 CDN URL | kodoHit 字段 | 2 |
| 16–18 | 保护 /api/chat 需 JWT；PRD 初稿核对 | 带 token 联调 | 2 |

**Day 1 验收（B）**
- [ ] `/api/auth/register` `/api/auth/login` 可用
- [ ] 七牛 Bucket 可上传测试图
- [ ] `/api/chat` 需登录

---

## Day 2 — V2 能力日（8h × 2）

### 开发者 A

| 时段 | 任务 | 交付物 | h |
|------|------|--------|---|
| 09–11 | useKodoUpload 直传 hook | 端侧直传 Kodo | 2 |
| 11–13 | Live2D thinking/speaking + 口型 | 四态完整 | 2 |
| 14–16 | useChatStream SSE + 流式 ChatPanel | 逐字显示 | 2 |
| 16–18 | 连续对话（TTS 完重启 STT）+ 摄像头切换 | US-9、US-11 | 2 |

**Day 2 验收（A）**
- [ ] SSE 流式首字可见
- [ ] 四态形象联动
- [ ] 前后摄像头可切换

### 开发者 B

| 时段 | 任务 | 交付物 | h |
|------|------|--------|---|
| 09–11 | upload-token API | GET /api/qiniu/upload-token | 2 |
| 11–13 | semanticCache.ts + chat 集成 | semanticHit | 2 |
| 14–16 | chatStream.ts SSE 路由 | POST /api/chat/stream | 2 |
| 16–18 | stt.ts 云端 STT + CHARACTER 定稿 | US-12 后端 | 2 |

**Day 2 验收（B）**
- [ ] 语义缓存同问秒回
- [ ] SSE  endpoint 稳定
- [ ] STT API 可 Postman 测

---

## Day 3 — 定稿 + 演示（8h × 2）

### 开发者 A

| 时段 | 任务 | 交付物 | h |
|------|------|--------|---|
| 09–11 | 云端 STT 前端切换 + 弱网重试 UI | US-10、US-12 | 2 |
| 11–13 | StatusBar：kodoHit/semanticHit/tokens | US-7 增强 | 2 |
| 14–16 | UI 打磨 + 响应式 | 演示级界面 | 2 |
| 16–18 | **演示视频 1–2 分钟** | 提交素材 | 2 |

### 开发者 B

| 时段 | 任务 | 交付物 | h |
|------|------|--------|---|
| 09–11 | Auth 安全复查 + 限流 + .env.example 更新 | 生产就绪配置 | 2 |
| 11–13 | DESIGN.md 更新 13/13 + README | 文档定稿 | 2 |
| 14–16 | npm run build + 联合 bug 修复 | 可构建 | 2 |
| 16–18 | GitHub 推送 + 提交清单勾选 | 远程同步 | 2 |

---

## 三天里程碑

| 时间 | 联合里程碑 |
|------|-----------|
| **Day 1 18:00** | 注册→登录→对话；七牛 Bucket 可用；cc404喵 idle |
| **Day 2 18:00** | 流式对话；四态；Kodo+语义缓存可演示 |
| **Day 3 18:00** | 13/13 用户故事 + 演示视频 + 文档齐全 |

---

## 文件归属

### 开发者 A

```
client/src/pages/Login.tsx
client/src/pages/Register.tsx
client/src/pages/ChatPage.tsx
client/src/context/AuthContext.tsx
client/src/components/Live2DAvatar.tsx
client/src/components/AvatarFallback.tsx
client/src/hooks/useKodoUpload.ts
client/src/hooks/useChatStream.ts
client/src/hooks/useMediaStream.ts   (摄像头切换)
client/src/hooks/useSpeechRecognition.ts (STT降级)
client/src/App.tsx                   (路由)
```

### 开发者 B

```
server/src/db.ts
server/src/middleware/auth.ts
server/src/routes/auth.ts
server/src/routes/qiniu.ts
server/src/routes/chatStream.ts
server/src/routes/stt.ts
server/src/services/qiniu.ts
server/src/services/semanticCache.ts
server/src/services/llm.ts
server/src/routes/chat.ts
docs/PRD.md
docs/CHARACTER.md
docs/QINIU_SETUP.md
docs/DESIGN.md
README.md
```

---

## 提交清单（Day 3 共同勾选）

- [ ] `npm run dev` 可运行
- [ ] 用户名+密码注册登录
- [ ] Live2D cc404喵四态
- [ ] 七牛 Kodo 缓存命中可演示
- [ ] SSE 流式对话
- [ ] docs/PRD.md + CHARACTER.md + QINIU_SETUP.md
- [ ] docs/DESIGN.md 用户故事 13/13
- [ ] GitHub 已推送
- [ ] 演示视频

---

## 风险

| 风险 | 负责人 | 应对 |
|------|--------|------|
| 七牛 Day 1 未就绪 | B | base64 降级，傍晚必须开通 |
| Live2D 搞不定 | A | AvatarFallback |
| Plan 模式无法改代码 | — | 切换 Agent 模式执行实现 |
