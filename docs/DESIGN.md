# AI 视觉对话助手 — 设计文档

> V2 目标版本。产品需求见 [PRD.md](./PRD.md)，角色设定见 [CHARACTER.md](./CHARACTER.md)，七牛搭建见 [QINIU_SETUP.md](./QINIU_SETUP.md)。

## 1. 项目概述

本应用是一款**端云协同**的多模态对话助手，核心体验由虚拟伙伴 **「cc404喵」** 承载：

- 用户以 **用户名 + 密码** 注册登录
- 登录后开启摄像头与麦克风，通过语音（或文字）与cc404喵对话
- cc404喵结合**当前摄像头画面**与**用户话语**给出中文回复（Live2D 四态 + 语音播报）
- 帧数据经 **七牛 Kodo/KCDN** 缓存加速，降低重复视觉理解成本

---

## 2. 系统架构（V2）

```
┌──────────────────────────────────────────────────────────────────┐
│                        端侧（浏览器 Edge）                          │
│  Login/Register → ChatPage（需 JWT）                              │
│  ┌──────────┐ ┌──────────────┐ ┌────────────┐ ┌───────────────┐  │
│  │ 摄像头预览 │ │ Web Speech   │ │ Live2Dcc404喵  │ │ Kodo直传      │  │
│  │ +切换前后  │ │ STT + TTS    │ │ 四态状态机  │ │ (uploadToken)│  │
│  └──────────┘ └──────────────┘ └────────────┘ └───────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ SSE 流式 UI · 语义/Token 状态栏 · 文字输入降级                  │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS + JWT
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                     云端代理（Node.js Server）                     │
│  Auth(JWT+SQLite) · 限流 · 语义缓存 · Kodo服务 · SSE · STT代理     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌─────────────────┐
        │ 七牛 Kodo │  │ 七牛 KCDN │  │ 多模态 LLM API  │
        │ 帧存储    │  │ 加速回源  │  │ (OpenAI 兼容)   │
        └──────────┘  └──────────┘  └─────────────────┘
```

### 数据流（V2）

1. 用户注册/登录 → 获得 JWT → 进入对话页，cc404喵问候
2. 点击「开始对话」→ 授权摄像头/麦克风 → 启动 Web Speech STT
3. 用户说完 → 端侧抓拍压缩帧 → （可选）直传 Kodo
4. 前端 `POST /api/chat/stream`（SSE）→ 服务端检查**语义缓存**
5. 未命中 → Kodo stat/upload → **CDN URL** 送 LLM（`detail: low`）
6. 流式 chunk 返回 → 对话区逐字渲染 → cc404喵 thinking/speaking
7. 分段 TTS 播报 → 结束后**自动重启 STT**（连续对话）

---

## 3. 用户故事：计划 vs 实现

| # | 用户故事 | 计划 | 实际 | 备注 |
|---|---------|------|------|------|
| US-0 | 注册登录后才能使用助手 | ✅ | ✅ | JWT + 路由守卫 |
| US-1 | 看到实时摄像头画面 | ✅ | ✅ | 本地 preview，不上传视频流 |
| US-2 | 自然语音对话 | ✅ | ✅ | Web Speech 连续识别 |
| US-3 | AI 结合画面回答 | ✅ | ✅ | 抓拍帧 + Kodo/CDN URL（已配置时）或 base64 降级 |
| US-4 | 听到 AI 语音回复 | ✅ | ✅ | TTS 可开关；整段播报（未做分段 TTS） |
| US-5 | 查看对话记录 | ✅ | ✅ | 流式气泡 UI |
| US-6 | STT 不可用时文字输入 | ✅ | ✅ | 底部输入框 |
| US-7 | 了解资源消耗 | ✅ | ✅ | tokens + kodoHit + semanticHit 状态栏 |
| US-8 | 记住最近几轮上下文 | ✅ | ✅ | 服务端 `sessions.json` 持久化 + `MEMORY_TURN_LIMIT` |
| US-9 | 会话内连续语音对话 | ✅ | ❌ | TTS 结束后未自动重启 STT |
| US-10 | 弱网环境下仍可用 | ✅ | ❌ | 无超时重试；文字输入仍可用 |
| US-11 | 切换前后摄像头 | ✅ | ❌ | 仅前置摄像头 |
| US-12 | 云端 STT 备选 | ✅ | ❌ | `/api/stt` 未实现 |

**实际实现率：11/13 可用（US-3/US-7 在七牛配置后完整）；4 项 P1 待后续 PR**

> MVP 阶段 8/12；当前已补齐 Auth、SSE、Live2D 四态、Kodo 服务端代传、语义缓存。

### 演示脚本（评审 2 分钟）

1. 注册/登录 → cc404喵 问候
2. 开始对话 → 持物对摄像头问「这是什么？」→ 流式回答，状态栏显示 tokens
3. **不换物品**，再问相同问题 → `semanticHit: true` 秒回（不调 LLM）
4. 同画面换问法但帧 hash 相同 → 第二次起 `kodoHit: true`（Kodo 命中）
5. 未配置七牛时自动 base64 降级，功能仍可用

---

## 4. 运营成本控制：计划 vs 实际采用

| 技巧 | 描述 | 计划 | 实际 | 实现位置 |
|------|------|------|------|---------|
| 本地音视频预览 | 视频流仅浏览器渲染 | ✅ | ✅ | `useMediaStream.ts` |
| 端侧 STT/TTS | Web Speech API | ✅ | ✅ | `useSpeechRecognition.ts` / `useSpeechSynthesis.ts` |
| 按需抓拍 | 说话结束抓一帧 | ✅ | ✅ | `frameCapture.ts` |
| 图像压缩 | ≤512px JPEG 0.65 | ✅ | ✅ | `frameCapture.ts` |
| 场景变化检测 | 画面未变跳过上传 | ✅ | ✅ | `isSceneChanged()` |
| 低精度视觉 | `detail: low` | ✅ | ✅ | `llm.ts` |
| 历史截断 | 最近 12 轮（可配置） | ✅ | ✅ | `conversationMemory.ts` + `llm.ts` |
| max_tokens 限制 | 300 | ✅ | ✅ | `llm.ts` |
| 服务端限流 | 10 次/分钟 | ✅ | ✅ | `index.ts` |
| Token 可视化 | 状态栏累计 | ✅ | ✅ | `StatusBar.tsx` |
| **七牛 Kodo 帧缓存** | 同 hash stat 命中 | ✅ | ✅ | `qiniu.ts`（服务端代传） |
| **KCDN URL 送模** | CDN URL 替代 base64 | ✅ | ✅ | `resolveImageUrl` → `llm.ts` |
| **语义缓存** | frameHash+text 精确匹配 TTL 10min | ✅ | ✅ | `semanticCache.ts` |
| **SSE 流式** | 降低首字感知延迟 | ✅ | ✅ | `chatStream.ts` |
| **服务端会话记忆** | sessionId + JSON 持久化 | ✅ | ✅ | `conversationMemory.ts` |
| **MCP + 网页 Skill** | 外接 MCP / DuckDuckGo 降级 | ✅ | ✅ | `mcpClient.ts` + `webSearchSkill.ts` |
| 端侧 Kodo 直传 | 减服务器带宽 | ✅ | ❌ | 待 `useKodoUpload.ts` |
| 分段 TTS | 流式播报 | ✅ | ❌ | 当前整段 TTS |
| 持续视频流分析 | 30fps 上传 | ❌ | ❌ | 成本过高，刻意不做 |
| 向量语义相似度 | 模糊匹配缓存 | ❌ | ❌ | 用精确匹配代替 |
| 本地 VLM 推理 | 端侧小模型 | ❌ | ❌ | 算力限制 |

### 成本估算（V2，单次对话）

| 组件 | 费用 | 说明 |
|------|------|------|
| STT/TTS | $0 | 端侧 Web Speech |
| 视觉（首次帧） | ~$0.0001 | low detail |
| 视觉（Kodo 命中 + 语义命中） | $0 | 不调 LLM |
| 文本生成 | ~$0.0001 | ~200 tokens |
| **典型合计** | **~$0.0002/轮** | 重复场景更低 |

---

## 5. 技术选型（V2）

| 层级 | 技术 |
|------|------|
| 前端 | React + Vite + TypeScript + React Router |
| 虚拟形象 | pixi.js + PNG 四态（Live2D 风格）；L3 可升级 Cubism，见 [CHARACTER.md §9](./CHARACTER.md) |
| 端侧语音 | Web Speech API（主）+ 云端 Whisper（降级） |
| 账号 | SQLite + bcrypt + JWT |
| 后端 | Express + TypeScript |
| 会话记忆 | JSON 文件 `server/data/sessions.json` |
| 外部感知 | MCP SDK（SSE）+ 网页查询 Skill |
| 对象存储 | 七牛 Kodo + KCDN |
| 多模态 AI | OpenAI 兼容接口 |
| 流式 | SSE (`/api/chat/stream`) |

---

## 6. 安全与隐私

- 密码 bcrypt 哈希；JWT 24h；Secret 放 `.env`
- API Key / 七牛 AK/SK 仅服务端
- 帧按需上传 Kodo，不录制完整视频
- 所有 Chat/STT/Qiniu 接口需登录
- 生产环境 HTTPS

---

## 7. 产品文档索引

| 文档 | 说明 |
|------|------|
| [PRD.md](./PRD.md) | 产品需求、范围、三天路线图 |
| [CHARACTER.md](./CHARACTER.md) | cc404喵人设与 Live2D 规范 |
| [AVATAR_ASSETS.md](./AVATAR_ASSETS.md) | L2 立绘素材规范与 GPT 提示词 |
| [MEMORY_AND_MCP.md](./MEMORY_AND_MCP.md) | 服务端记忆 + MCP 联网 |
| [QINIU_SETUP.md](./QINIU_SETUP.md) | 七牛从 0 搭建 |
| [WORK_DIVISION.md](./WORK_DIVISION.md) | 两人三天分工 |

---

## 8. V2.1 后续扩展

- 聊天历史持久化（已实现，见 [MEMORY_AND_MCP.md](./MEMORY_AND_MCP.md)）
- 向量语义缓存
- 定制 Live2D 立绘（**L3 Cubism**：`.model3.json` + `Part_OctopusClip`，见 [CHARACTER.md §9](./CHARACTER.md)、[AVATAR_ASSETS.md](./AVATAR_ASSETS.md)）
- **隐私模式 + 表情驱动虚拟形象**（已评估、暂不实现）：当前 cc404 为 PNG 四态而非 Cubism 参数模型，无法精细镜像用户表情；若要做需 MediaPipe 本地检测 + 真 Live2D 模型，工作量大。当前版本保留为稳定基线，体验不佳时可回退。
- 七牛边缘函数预处理
- Refresh Token / 邮箱验证
