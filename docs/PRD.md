# AI 视觉对话助手 — 产品需求文档（PRD）

> **版本**：V2.0  
> **读者**：两人开发团队（开发者 A · 端侧 / 开发者 B · 云端）  
> **登录方式**：用户名 + 密码（已确认）  
> **核心体验**：注册登录 → 见虚拟助手「cc404喵」→ 摄像头 + 语音对话  
> **交付周期**：三天（MVP 已有，冲刺 V2 全量）

---

## 1. 背景与目标

### 1.1 赛题要求

开发一款 AI 对话应用：打开摄像头与麦克风，让 AI **看见**视频内容、**听见**用户说话，并给出恰当回应。需兼顾：

- 视觉理解准确性
- 语音交互自然度与流畅性
- 端云协同的成本控制

额外交付设计文档：用户故事计划 vs 实现、成本控制技巧计划 vs 采用。

### 1.2 产品升级目标（V2）

在已有 MVP 基础上，三天内完成：

| 维度 | V2 目标 |
|------|---------|
| 账号 | 用户名+密码注册/登录，未登录不可对话 |
| 虚拟形象 | Live2D 卡通助手「cc404喵」，四态联动 |
| 七牛云 | 从 0 开通 Kodo + KCDN，帧缓存 + 直传 |
| 对话体验 | SSE 流式输出、连续语音、STT 降级 |
| 用户故事 | **12/12 + US-0 账号** 全部可演示 |

### 1.3 成功标准（Day 3 18:00）

- [ ] 用户可注册、登录、登出
- [ ] 登录后见cc404喵 Live2D 形象（至少 idle/listening/thinking/speaking）
- [ ] 语音 + 画面多模态问答正确
- [ ] 七牛 Kodo 缓存命中可演示（`kodoHit: true`）
- [ ] 语义缓存秒回可演示（`semanticHit: true`）
- [ ] SSE 流式首字 < 2s
- [ ] 演示视频 1–2 分钟，含注册→对话→缓存命中
- [ ] 文档齐全：PRD、CHARACTER、QINIU_SETUP、DESIGN、WORK_DIVISION

---

## 2. 用户与场景

### 2.1 目标用户

| 用户 | 描述 | 核心诉求 |
|------|------|---------|
| 普通用户 | 首次使用视觉 AI 助手 | 低门槛上手、自然对话 |
| 演示/评审 | 七牛云实训评审老师 | 看到端云协同、成本意识、创新点 |
| 开发者 A/B | 两人团队 | 文档即执行手册，按天验收 |

### 2.2 核心场景

**场景 S1：注册后首次见cc404喵（P0）**

1. 打开应用 → 跳转登录页
2. 点击「注册」→ 输入用户名、密码（≥6 位）→ 注册成功自动登录
3. 进入对话页 → cc404喵 Live2D 显示 → 播报/展示：「你好，{用户名}，我是cc404喵！」
4. 点击「开始对话」→ 授权摄像头/麦克风 → 直接说话

**场景 S2：物品识别 + 七牛缓存（P0 演示推荐）**

1. 登录用户手持物品对摄像头
2. 问：「你看看我手里拿的是什么？」
3. cc404喵进入 thinking → 流式输出回答
4. 状态栏显示 tokens、Kodo 命中情况
5. **不换物品**，再问类似问题 → 第二次 `kodoHit: true` 或 `semanticHit: true`

**场景 S3：弱网 / STT 降级（P1）**

1. Web Speech 不可用时（Safari 或模拟）→ 自动或手动走云端 STT
2. 网络慢时显示重试提示，文字输入始终可用

---

## 3. 产品范围

### 3.1 P0 — 必须交付

| ID | 功能 | 说明 |
|----|------|------|
| FR-0 | 用户注册 | 用户名 2–20 字符，密码 ≥6 位 |
| FR-1 | 用户登录/登出 | JWT 24h，localStorage 存储 |
| FR-2 | 路由守卫 | 未登录 → `/login` |
| FR-3 | 七牛从 0 搭建 | 见 [QINIU_SETUP.md](./QINIU_SETUP.md) |
| FR-4 | Kodo 帧缓存 | 同帧 hash 不重复上传 |
| FR-5 | KCDN URL 送模 | LLM 用 CDN URL，非 base64 |
| FR-6 | 虚拟助手对话 | 现有 MVP 能力，登录后可用 |
| FR-7 | Live2D cc404喵 | 四态 + **Claude Code 小章鱼发卡** + 活泼开朗语气 |

### 3.2 P1 — V2 全量（三天内完成）

| ID | 功能 | 对应用户故事 |
|----|------|-------------|
| FR-8 | 端侧 Kodo 直传 | 上传凭证 API |
| FR-9 | 语义缓存 | hash + text 精确匹配，TTL 10min |
| FR-10 | SSE 流式对话 | 逐字显示 + 分段 TTS |
| FR-11 | 连续语音对话 | TTS 结束自动重启 STT |
| FR-12 | 摄像头切换 | 前/后置 |
| FR-13 | 云端 STT 降级 | `/api/stt` |
| FR-14 | 弱网重试 | 超时提示 + 文字降级 |
| FR-15 | 成本状态栏 | tokens / kodoHit / semanticHit |

### 3.3 不做（三天范围外）

- 邮箱/手机验证码、OAuth 第三方登录
- 聊天历史持久化入库
- 向量语义相似度检索
- 定制 Live2D 立绘（用官方免费模型）
- 真正唤醒词 VAD（用会话内自动重启 STT 代替 US-9）

---

## 4. 功能需求详述

### 4.1 账号体系（用户名 + 密码）

**注册**

- 输入：用户名、密码、确认密码
- 校验：用户名唯一；密码 ≥6 位
- 成功：返回 JWT，跳转对话页

**登录**

- 输入：用户名、密码
- 失败：统一提示「用户名或密码错误」
- 成功：返回 JWT + username

**鉴权**

- 所有 `/api/chat`、`/api/chat/stream`、`/api/stt`、`/api/qiniu/*` 需 `Authorization: Bearer {token}`
- 401 时前端清 token，跳转登录

**数据库**

- SQLite 单文件 `server/data/users.json`（Day 1 免编译；可升级 SQLite）
- 密码 bcrypt 哈希，明文不落库

### 4.2 虚拟助手「cc404喵」

详见 [CHARACTER.md](./CHARACTER.md)。

- 登录后居对话页主视觉位
- **视觉标志**：头戴 Claude Code 风格小章鱼发卡（暖橙色 Q 版章鱼，Live2D 触须可微动）
- **人设**：活泼开朗，口语化，2–4 句，适合 TTS
- 状态与 `isListening / isLoading / isSpeaking` 联动
- System Prompt 注入 cc404喵 人设与当前用户名

### 4.3 对话核心流程

```
用户说话结束
  → 端侧抓拍压缩帧
  → （可选）直传 Kodo
  → POST /api/chat/stream（SSE）
  → 服务端：语义缓存? → Kodo URL → LLM 流式
  → 前端：逐字渲染 + cc404喵 thinking/speaking + 分段 TTS
  → TTS 结束 → 自动重启 STT（连续对话）
```

### 4.4 非功能需求

| 类别 | 要求 |
|------|------|
| 延迟 | SSE 首字 < 2s（正常网络） |
| 成本 | 端侧 STT/TTS；按需单帧；Kodo 去重；语义缓存 |
| 安全 | API Key / 七牛 Key 仅服务端；JWT Secret 放 .env |
| 隐私 | 不录制视频；帧仅按需上传 Kodo |
| 兼容 | Chrome/Edge 全功能；Safari 文字 + 云端 STT 降级 |
| 浏览器 | 摄像头/麦克风需 HTTPS 或 localhost |

---

## 5. 创新点专章

### 5.1 虚拟伙伴，而非工具框

- Live2D cc404喵提供情感反馈，降低与 AI 对话的疏离感
- 四态状态机让用户感知「她在听、在想、在说」

### 5.2 端云协同成本工程

| 层级 | 策略 |
|------|------|
| 端侧 | Web Speech STT/TTS（$0）；按需抓拍；场景去重 |
| 七牛 | Kodo 帧 hash 缓存；KCDN 加速；直传减服务器带宽 |
| 云端 | 语义缓存；历史截断；max_tokens；限流 |
| 感知 | 状态栏实时 tokens + 缓存命中 |

### 5.3 七牛云存算分离

- 视觉资产（帧）与算力（LLM）分离
- 重复场景只存一次、只理解一次（语义缓存）
- 详见 [QINIU_SETUP.md](./QINIU_SETUP.md)

---

## 6. 用户故事验收表（V2 目标 13/13）

| # | 用户故事 | 优先级 | 验收标准 |
|---|---------|--------|---------|
| US-0 | 注册登录后才能使用助手 | P0 | 未登录访问 `/` 跳转登录 |
| US-1 | 看到实时摄像头画面 | P0 | 本地 preview，不上传流 |
| US-2 | 自然语音对话 | P0 | Web Speech 连续识别 |
| US-3 | AI 结合画面回答 | P0 | 抓拍帧 + 多模态 API |
| US-4 | 听到 AI 语音回复 | P0 | TTS 可开关 |
| US-5 | 查看对话记录 | P0 | 气泡 UI |
| US-6 | STT 不可用时文字输入 | P0 | 底部输入框 |
| US-7 | 了解资源消耗 | P0 | tokens + 缓存命中 |
| US-8 | 记住最近几轮上下文 | P0 | 最近 6 轮 |
| US-9 | 会话内连续语音对话 | P1 | TTS 完自动重启 STT |
| US-10 | 弱网仍可用 | P1 | 重试 + 文字降级 |
| US-11 | 切换前后摄像头 | P1 | facingMode 按钮 |
| US-12 | 云端 STT 备选 | P1 | `/api/stt` 可用 |

---

## 7. 三天版本路线图

### Day 1 — 基础设施日

| 开发者 A | 开发者 B |
|---------|---------|
| 登录/注册页面 + 路由守卫 | 七牛从 0 开通（QINIU_SETUP） |
| Live2D 挂载 idle/listening | SQLite + Auth API + JWT 中间件 |
| 登录后对话页框架 | Kodo 服务 + chat CDN URL |

**里程碑**：注册 → 登录 → 对话；七牛 Bucket 可用；cc404喵可显示。

### Day 2 — V2 能力日

| 开发者 A | 开发者 B |
|---------|---------|
| Kodo 直传 hook | 上传凭证 API + 语义缓存 |
| Live2D thinking/speaking | SSE `/api/chat/stream` |
| 流式 UI + 分段 TTS | `/api/stt` 云端 STT |
| 连续对话 + 摄像头切换 | CHARACTER.md 定稿 |

**里程碑**：流式对话；四态形象；缓存可演示。

### Day 3 — 定稿 + 演示

| 开发者 A | 开发者 B |
|---------|---------|
| 弱网重试 + UI 打磨 | PRD/WORK_DIVISION 定稿 |
| 演示视频录制 | DESIGN.md 更新 + GitHub |

**里程碑**：13/13 用户故事可演示；文档齐全。

---

## 8. 演示 Checklist（2 分钟脚本）

1. **0:00–0:20** 注册账号 → 登录 → 见cc404喵打招呼  
2. **0:20–0:40** 开始对话 → 授权摄像头 → 问「我手里拿的是什么？」  
3. **0:40–1:10** cc404喵流式回答 + 四态切换 + 状态栏 tokens  
4. **1:10–1:30** 同物品再问 → 展示 Kodo/语义缓存命中  
5. **1:30–2:00** 切换摄像头 / 文字输入降级（可选其一）

---

## 9. 接口摘要

### Auth

```
POST /api/auth/register  { username, password }
POST /api/auth/login     { username, password }
GET  /api/auth/me        Authorization: Bearer
```

### Chat

```
POST /api/chat         { text, imageBase64?, imageKey?, history, skipImage? }
POST /api/chat/stream  同上，SSE 流式
POST /api/stt          { audioBase64, mimeType? }
GET  /api/qiniu/upload-token?key=frames/{hash}.jpg
```

### Chat 响应扩展字段

```json
{
  "reply": "...",
  "usage": { "total_tokens": 120 },
  "sentImage": true,
  "kodoHit": false,
  "semanticHit": false,
  "imageUrl": "https://cdn.example.com/frames/abc.jpg"
}
```

---

## 10. 风险与依赖

| 风险 | 应对 |
|------|------|
| 七牛实名审核慢 | Day 1 09:00 第一时间注册 |
| Live2D 集成耗时 | Day 3 16:00 前未通 → AvatarFallback 应急 |
| 48h 工时紧 | MVP 已省 ~24h；砍 OAuth、历史入库 |
| Plan 模式阻塞代码 | 需 Agent 模式执行实现 |

---

## 附录

- 角色设定：[CHARACTER.md](./CHARACTER.md)
- 七牛搭建：[QINIU_SETUP.md](./QINIU_SETUP.md)
- 分工计划：[WORK_DIVISION.md](./WORK_DIVISION.md)
- 技术设计：[DESIGN.md](./DESIGN.md)
