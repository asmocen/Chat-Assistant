# Day 1 联调清单 — Auth Mock + 前端 Stub + 后端验收

> **用途**：你（M1+M4+M5）与搭档（M2+M3）Day 1 并行开发，**13:00 / 18:00** 按本清单联调。  
> **原则**：后端未就绪时前端用 Mock；后端就绪后切真实 API，Mock 代码保留在 `client/src/mocks/` 便于回归。

---

## 0. 联调时间表

| 时间 | 目标 | 参与 |
|------|------|------|
| **13:00** | 注册 → 登录 → `/auth/me` 通；前端能带 JWT 进 ChatPage | 你 + 搭档 |
| **18:00** | 登录后 SSE 出字；cc404喵 可见；帧走后端（或 base64 降级） | 你 + 搭档 |

---

## 1. 后端 Auth 接口清单（搭档 M1 后端部分）

### 1.1 必须实现的 3 个接口

| # | 方法 | 路径 | 鉴权 | 状态 |
|---|------|------|------|------|
| B1 | POST | `/api/auth/register` | 无 | ☐ |
| B2 | POST | `/api/auth/login` | 无 | ☐ |
| B3 | GET | `/api/auth/me` | Bearer JWT | ☐ |

### 1.2 请求 / 响应契约（不可改）

**B1 注册**

```http
POST /api/auth/register
Content-Type: application/json

{ "username": "demo", "password": "123456" }
```

| 场景 | HTTP | Body |
|------|------|------|
| 成功 | 201 | `{ "token": "<jwt>", "username": "demo" }` |
| 用户名已存在 | 409 | `{ "error": "用户名已被注册" }` |
| 密码太短 | 400 | `{ "error": "密码至少 6 位" }` |
| 用户名为空 | 400 | `{ "error": "请填写用户名和密码" }` |

**B2 登录**

```http
POST /api/auth/login
Content-Type: application/json

{ "username": "demo", "password": "123456" }
```

| 场景 | HTTP | Body |
|------|------|------|
| 成功 | 200 | `{ "token": "<jwt>", "username": "demo" }` |
| 失败 | 401 | `{ "error": "用户名或密码错误" }` |

**B3 当前用户**

```http
GET /api/auth/me
Authorization: Bearer <jwt>
```

| 场景 | HTTP | Body |
|------|------|------|
| 成功 | 200 | `{ "username": "demo", "userId": 1 }` |
| 未登录/过期 | 401 | `{ "error": "请先登录" }` 或 `{ "error": "登录已过期，请重新登录" }` |

### 1.3 后端自检命令（搭档 12:30 前跑通）

```bash
# 注册
curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"demo\",\"password\":\"123456\"}"

# 登录（记下 token）
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"demo\",\"password\":\"123456\"}"

# me（替换 TOKEN）
curl -s http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer TOKEN"
```

**后端 Done 定义（13:00 前）**

- [ ] 三条 curl 均返回预期 JSON
- [ ] `server/data/users.db` 已 gitignore
- [ ] `.env` 含 `JWT_SECRET`
- [ ] 密码 bcrypt 存储，响应中无 password 字段

---

## 2. Auth Mock 清单（你 — 后端未就绪时用）

### 2.1 Mock 文件建议

```
client/src/mocks/
├── authMock.ts      # 假 register/login/me
└── enableMock.ts    # VITE_USE_MOCK=true 时启用
```

### 2.2 Mock 行为（与真实 API 一致）

| 接口 | Mock 逻辑 |
|------|-----------|
| register | 任意 username≥2 + password≥6 → 返回 `{ token: "mock-jwt-"+username, username }` |
| login | 同上（不校验数据库，仅格式校验） |
| me | 解析 `mock-jwt-{username}` → 返回 `{ username, userId: 1 }` |

**Mock 固定测试账号（可选）**

```
username: demo
password: 123456
token:    mock-jwt-demo
```

### 2.3 环境开关

```env
# client/.env.development
VITE_USE_AUTH_MOCK=true   # 13:00 前 true，联调通过后 false
VITE_API_BASE=            # 空则走 vite proxy /api
```

### 2.4 `authFetch` 分支伪代码

```typescript
// client/src/lib/api.ts
export async function authFetch(path: string, init?: RequestInit) {
  if (import.meta.env.VITE_USE_AUTH_MOCK === 'true') {
    return authMockFetch(path, init);
  }
  const token = localStorage.getItem('chat_token');
  return fetch(`/api${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
  });
}
```

**Mock Done 定义（12:00 前，你可独立完成）**

- [ ] `VITE_USE_AUTH_MOCK=true` 时可注册/登录进 ChatPage
- [ ] token 写入 `localStorage.chat_token`
- [ ] 刷新页面仍保持登录（读 token + 调 me 或解析 mock token）

---

## 3. 前端 Stub 清单（你 — M1 前端部分）

### 3.1 路由与页面

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| F1 | 安装 react-router-dom | `client/package.json` | ☐ |
| F2 | 路由表 | `App.tsx` | ☐ |
| F3 | 登录页 | `pages/Login.tsx` | ☐ |
| F4 | 注册页 | `pages/Register.tsx` | ☐ |
| F5 | 对话页 | `pages/ChatPage.tsx` | ☐ |

**路由约定**

| 路径 | 组件 | 守卫 |
|------|------|------|
| `/login` | Login | 已登录 → 重定向 `/` |
| `/register` | Register | 已登录 → 重定向 `/` |
| `/` | ChatPage | 未登录 → 重定向 `/login` |

### 3.2 AuthContext 字段

| 字段/方法 | 类型 | 说明 |
|-----------|------|------|
| `username` | `string \| null` | 当前用户 |
| `token` | `string \| null` | JWT |
| `isAuthenticated` | `boolean` | 是否登录 |
| `login(username, password)` | fn | 调 POST `/auth/login` |
| `register(username, password)` | fn | 调 POST `/auth/register` |
| `logout()` | fn | 清 token，跳 `/login` |
| `loading` | `boolean` | 初始化读 token 时 |

### 3.3 localStorage 约定

| Key | 值 |
|-----|-----|
| `chat_token` | JWT 字符串 |
| `chat_username` | 用户名（可选，me 失败时兜底） |

### 3.4 登录成功后的跳转

1. 存 token + username  
2. `navigate('/')`  
3. ChatPage 展示 cc404喵 欢迎语（见 CHARACTER.md）：

   > 嗨，{username}！我是 cc404喵，你的视觉对话小助手～

**前端 M1 Done（13:00）**

- [ ] 未登录访问 `/` → `/login`
- [ ] 注册成功自动登录并进 `/`
- [ ] 登出回 `/login`
- [ ] Login/Register 表单校验：密码 ≥6，用户名 2–20
- [ ] 错误展示：展示 API 返回的 `error` 字段

---

## 4. Day 1 下午 — SSE Stub 清单（18:00 联调）

> 13:00 Auth 通过后，你先用 **SSE Mock** 开发 ChatPage + cc404喵；搭档并行做真实 `/chat/stream`。

### 4.1 SSE Mock 事件（与 ENGINEERING_PLAN 一致）

```
event: meta
data: {"kodoHit":false,"semanticHit":false,"sentImage":false,"imageUrl":null}

event: chunk
data: {"text":"嗨"}

event: chunk
data: {"text":"，我是 cc404喵～"}

event: done
data: {"reply":"嗨，我是 cc404喵～","usage":{"total_tokens":42}}
```

### 4.2 前端 `useChatStream` Stub 要点

| # | 行为 | 状态 |
|---|------|------|
| S1 | 请求头带 `Authorization: Bearer` | ☐ |
| S2 | POST body 含 `text`, `history`, `skipImage` | ☐ |
| S3 | 解析 SSE：`meta` → 更新 StatusBar | ☐ |
| S4 | 解析 `chunk` → 追加 streaming 气泡 | ☐ |
| S5 | `done` → 固化 assistant 消息，清 streaming | ☐ |
| S6 | `error` →  toast / 气泡内错误文案 | ☐ |

### 4.3 Mock 开关

```env
VITE_USE_STREAM_MOCK=true   # 18:00 前 true
```

### 4.4 18:00 切换真实 SSE

**搭档需提供**（最低可用）：

```http
POST /api/chat/stream
Authorization: Bearer <token>
{ "text": "你好", "history": [], "skipImage": true }
```

返回至少 1 个 `chunk` + 1 个 `done`（可先不接七牛/千问，固定回复「你好，我是 cc404喵」亦可）。

**18:00 Done**

- [ ] `VITE_USE_*_MOCK=false` 全流程通
- [ ] cc404喵 Fallback/Live2D idle 可见
- [ ] 说一句话 → SSE 有回复展示

---

## 5. 13:00 联合验收 Checklist（打印勾选）

### 你（前端）

- [ ] Mock 或真实 API：注册 `test01` 成功
- [ ] 登录 `test01` 进入 ChatPage
- [ ] 刷新页面仍保持登录
- [ ] 点击登出回登录页
- [ ] 欢迎语含用户名 + cc404喵

### 搭档（后端）

- [ ] curl 三条 Auth 通过
- [ ] CORS `CLIENT_ORIGIN=http://localhost:5173` 正确
- [ ] 重复注册返回 409

### 共同

- [ ] 浏览器 Network 可见 `/api/auth/login` 200
- [ ] 后续请求 Header 含 `Authorization: Bearer`
- [ ] 约定：下午 SSE 字段不再改（见 ENGINEERING_PLAN §4.2）

---

## 6. 常见问题

| 现象 | 排查 |
|------|------|
| 401 on /auth/me | token  key 是否 `chat_token`；Bearer 前缀 |
| CORS 错误 | 后端 `cors({ origin: CLIENT_ORIGIN })` |
| 注册 409 | 换用户名或删 `server/data/users.db` 重建 |
| Mock 切真实失败 | `VITE_USE_AUTH_MOCK=false` 后重启 `npm run dev:client` |
| SSE 无 chunk | 检查 `Content-Type: text/event-stream`；勿被 limiter 拦 |

---

## 7. 相关文档

- [ENGINEERING_PLAN.md](./ENGINEERING_PLAN.md) — 全栈 API 契约
- [CHARACTER.md](./CHARACTER.md) — cc404喵 欢迎语
- [QINIU_SETUP.md](./QINIU_SETUP.md) — 搭档上午七牛任务

---

## 8. Day 2 预告（本清单不涉及，仅对齐）

| 时间 | 切换 |
|------|------|
| Day 2 AM | `VITE_USE_STREAM_MOCK=false` 常开；接入 `useKodoUpload` |
| Day 2 PM | 真实 `kodoHit` / `semanticHit` 字段 |
