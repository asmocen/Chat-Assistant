# 作品提交要求

> 本文档汇总赛题/评审对 **作品有效性** 与 **PR（Pull Request）提交规范** 的硬性要求。  
> 团队所有成员在开发前须阅读，提交前须对照勾选。

---

## 一、适用范围

- 仓库：[asmocen/Chat-Assistant](https://github.com/asmocen/Chat-Assistant)
- 主分支：`main`（须始终保持可运行）
- 协作方式：功能分支 → PR → 合并 `main`

---

## 二、作品有效性

### 2.1 必须满足

| # | 要求 | 说明 |
|---|------|------|
| 1 | **选题一致、独立完成** | 作品须与所选赛题一致，不得抄袭他人代码 |
| 2 | **持续提交记录** | 从项目启动起须有 **连续的 PR 与 commit 记录**，禁止最后一天突击提交全部代码 |
| 3 | **时间戳合规** | 所有 commit 时间戳须落在所选批次的起止时间内 |
| 4 | **主分支可运行** | 任意时刻 checkout `main` 后 `npm run dev` 可正常启动 |

### 2.2 视为无效的情形

- PR 描述为空，或与实际代码改动严重不符
- 使用第三方库/框架但未在 `README` 中列出，且未在 PR 中说明原创部分
- 复用自己过往代码片段，但未在 PR 描述中注明出处
- **仅在最后一天一次性提交全部代码**（无过程性 PR/commit）

### 2.3 本项目第三方依赖（须在 PR 中引用）

主要依赖见根目录 `package.json` 与各 workspace `package.json`，包括但不限于：

| 类别 | 依赖 | 用途 |
|------|------|------|
| 前端框架 | React 19、Vite 6、TypeScript | UI 与构建 |
| 虚拟形象 | pixi.js、pixi-live2d-display | Live2D 渲染（可选降级 PNG） |
| 后端 | Express、better-sqlite3、jsonwebtoken | API 与鉴权 |
| 云存储 | qiniu SDK | Kodo 帧缓存 |
| AI | 通义千问 qwen-vl-plus（DashScope 兼容 API） | 多模态理解 |

原创部分：业务逻辑、端云协同架构、成本控制策略、cc404喵 角色与交互流程等，见 [DESIGN.md](./DESIGN.md)。

---

## 三、PR（Pull Request）提交规范

### 3.1 基本原则

1. **新功能通过 PR 合入**，禁止直接向 `main` 推送功能代码（紧急 hotfix 除外，须补 PR 说明）
2. **每个 PR 只做一件事**：实现或修改 **一个功能点**；鼓励小步、细粒度 PR
3. 大功能须拆成多个独立 PR，按依赖顺序合并

### 3.2 PR 描述必填项

每个 PR 的标题与正文须包含以下四部分（GitHub 创建 PR 时会自动加载模板）：

| 字段 | 要求 |
|------|------|
| **标题** | 一句话说明新增/修改内容 |
| **功能说明** | 该功能的目的与使用方式 |
| **实现思路** | 技术选型或核心逻辑简述 |
| **测试方法** | 如何验证该功能可用 |

### 3.3 合并后要求

- PR 合并后 `main` 分支必须处于 **可运行** 状态
- 评审可随时 checkout `main` 复现项目效果

### 3.4 分支命名

```
feature/<模块>-<简述>    例：feature/auth-login
fix/<问题简述>            例：fix/camera-reliability
docs/<文档简述>          例：docs/pr-guidelines
chore/<杂项>              例：chore/sync-scripts
```

### 3.5 Commit 信息规范

```
<type>(<scope>): <简短说明>

type: feat | fix | docs | chore | refactor | test
scope: auth | chat | qiniu | avatar | stt | docs | sync
```

示例：

```
feat(auth): add username/password register and JWT login
fix(chat): resolve SSE token stats not updating
docs(pr): add submission requirements and PR workflow
```

---

## 四、推荐开发节奏（三天项目）

| 天 | 建议 PR 粒度 | 示例 |
|----|-------------|------|
| Day 1 | 2–4 个 PR | auth、SSE 骨架、cc404喵 占位、文档 |
| Day 2 | 2–4 个 PR | 七牛缓存、语义缓存、Live2D 四态、STT 降级 |
| Day 3 | 1–2 个 PR | UI 打磨、演示文档、联调修复 |

**每天至少 1 次 PR 合并**，避免最后一天集中提交。

---

## 五、提交前自检清单

合并 PR 或推送前，确认：

- [ ] 已从最新 `main` 拉取并 rebase/merge
- [ ] `npm run dev` 本地可运行
- [ ] PR 标题与描述四要素已填写
- [ ] 未提交 `.env`、密钥、个人数据
- [ ] 第三方依赖已在 README 或 PR 中说明
- [ ] 复用代码已注明出处
- [ ] `main` 合并后评审可一键复现

---

## 六、相关文档

| 文档 | 说明 |
|------|------|
| [PR_WORKFLOW.md](./PR_WORKFLOW.md) | 日常 PR 操作流程（命令与示例） |
| [PR_HISTORY.md](./PR_HISTORY.md) | 已有 commit 与 PR 对照记录 |
| [SYNC.md](./SYNC.md) | 本地与 GitHub 同步 |
| [../.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md) | GitHub PR 自动模板 |
