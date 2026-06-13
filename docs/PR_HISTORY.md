# PR 与 Commit 对照记录

> 用于补齐「持续 PR 记录」要求：历史直接推送到 `main` 的提交，在此按 **等效 PR** 归档；  
> **此后新功能须走真实 GitHub PR**（见 [PR_WORKFLOW.md](./PR_WORKFLOW.md)）。

---

## 当前统计

| 指标 | 数量 | 状态 |
|------|------|------|
| Commit（main） | 4 | 已推送 |
| 等效 PR 文档 | 4 | 见下表 |
| 真实 GitHub PR | 0 | **待后续按规范补开** |

---

## 等效 PR 归档（历史提交）

### PR-001 — Initial release

| 字段 | 内容 |
|------|------|
| **合并 commit** | `22474fd` (2026-06-12) |
| **标题** | feat(core): AI visual dialogue assistant MVP |
| **功能说明** | 项目初始化：React 前端 + Express 后端，摄像头预览、Web Speech STT/TTS、多模态对话代理 |
| **实现思路** | Monorepo（client/server workspaces）；端侧感知 + 云端 LLM 代理；按需帧抓拍与压缩 |
| **测试方法** | `npm install && cp .env.example .env && npm run dev`，访问 :5173 开始对话 |

---

### PR-002 — Day 1: Auth + SSE + cc404喵

| 字段 | 内容 |
|------|------|
| **合并 commit** | `2e18127` (2026-06-13) |
| **标题** | feat(auth,chat,avatar): Day 1 auth, SSE streaming, and cc404喵 |
| **功能说明** | 用户名密码注册登录；JWT 鉴权；SSE 流式对话；cc404喵 形象与产品文档 |
| **实现思路** | SQLite + bcrypt + JWT；`/api/chat/stream` SSE；AvatarFallback PNG 四态；docs PRD/DESIGN 等 |
| **测试方法** | 注册→登录→对话页；说话后 SSE 逐字显示；未登录跳转 /login |

---

### PR-003 — Fix env, layout, camera

| 字段 | 内容 |
|------|------|
| **合并 commit** | `4481303` (2026-06-13) |
| **标题** | fix(core): env loading, token stats, layout, and camera reliability |
| **功能说明** | 修复 .env 加载、Token 统计、布局与摄像头稳定性 |
| **实现思路** | 服务端 dotenv 路径修正；StatusBar token 累计；useMediaStream 重试与错误提示 |
| **测试方法** | 配置 .env 后重启；对话后状态栏 token 递增；反复开关摄像头无崩溃 |

---

### PR-004 — Git sync scripts

| 字段 | 内容 |
|------|------|
| **合并 commit** | `990991b` (2026-06-13) |
| **标题** | chore(sync): add git sync scripts and asmocen remote |
| **功能说明** | 本地与 GitHub（asmocen）/ 上游（NuoChe）双向同步脚本 |
| **实现思路** | `scripts/git-sync.mjs` + npm scripts；origin/upstream 双远程 |
| **测试方法** | `npm run sync:status`；`npm run sync:push` 推送到 asmocen/Chat-Assistant |

---

## 待开真实 PR（后续开发）

| 计划 PR | 分支建议 | 内容 | 优先级 |
|---------|----------|------|--------|
| PR-005 | `feature/semantic-cache` | 语义缓存 semanticHit | P0 |
| PR-006 | `feature/kodo-upload` | 前端 Kodo 直传 | P0 |
| PR-007 | `feature/live2d` | Live2D 四态启用 | P1 |
| PR-008 | `feature/stt-fallback` | 云端 STT 降级 | P1 |
| PR-009 | `docs/pr-standards` | PR 规范与提交要求文档 | P0 |

> 每完成一行，在 GitHub 创建真实 PR 并在此表追加链接，例如：  
> `PR-009: https://github.com/asmocen/Chat-Assistant/pull/1`

---

## 维护说明

1. **新 PR 合并后**：在本文件「待开真实 PR」下方追加一行，填写 PR 链接与合并日期  
2. **禁止** 再在无 PR 的情况下向 `main` 推送功能代码  
3. 评审抽查时：GitHub PR 列表 + 本文件 + `git log` 三者对照
