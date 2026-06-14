# PR 工作流程

> 配合 [SUBMISSION_REQUIREMENTS.md](./SUBMISSION_REQUIREMENTS.md) 使用。  
> **默认规则：功能开发不走 `main` 直推，一律 feature 分支 + PR。**

---

## 1. 标准流程

```
main ──► feature/xxx ──► commit(s) ──► push ──► 开 PR ──► 合并 main
```

### 步骤 1：同步最新 main

```bash
git checkout main
npm run sync:pull    # 或 git pull origin main
```

### 步骤 2：创建功能分支

```bash
npm run pr:new -- feature/auth-login
# 等价于: git checkout -b feature/auth-login
```

### 步骤 3：开发并提交

```bash
# 编辑代码…
git add .
git commit -m "feat(auth): add register and login pages"
```

### 步骤 4：推送分支

```bash
npm run pr:push
# 或: git push -u origin HEAD
```

### 步骤 5：在 GitHub 创建 PR

1. 打开 https://github.com/asmocen/Chat-Assistant/compare
2. base: `main` ← compare: `feature/xxx`
3. 按模板填写：标题、功能说明、实现思路、测试方法
4. 自检通过后合并（Merge pull request）

### 步骤 6：合并后清理本地

```bash
git checkout main
git pull origin main
git branch -d feature/auth-login
```

---

## 2. npm 命令速查

| 命令 | 作用 |
|------|------|
| `npm run pr:new -- <分支名>` | 从 main 创建并切换到功能分支 |
| `npm run pr:push` | 推送当前分支到 origin（非 main 直推） |
| `npm run pr:check` | 检查是否误在 main 上开发、是否有未提交更改 |
| `npm run sync:pull` | 拉取 origin/main 最新代码 |
| `npm run sync:status` | 查看本地与远程差异 |

---

## 3. PR 描述模板（复制备用）

```markdown
## 标题
feat(scope): 一句话说明

## 功能说明
- 目的：
- 用户如何使用：

## 实现思路
- 技术选型：
- 核心逻辑：
- 涉及文件：

## 测试方法
1. `npm run dev`
2. 打开 http://localhost:5173
3. 操作步骤：…
4. 预期结果：…

## 自检
- [ ] main 合并后可运行
- [ ] 未包含 .env / 密钥
- [ ] 第三方依赖已说明（如适用）
```

GitHub 网页创建 PR 时会自动加载 `.github/PULL_REQUEST_TEMPLATE.md`。

---

## 4. 禁止事项

| 禁止 | 正确做法 |
|------|----------|
| `git push origin main` 提交新功能 | 走 feature 分支 + PR |
| 一个 PR 改多个无关功能 | 拆成多个 PR |
| 空 PR 描述 | 填齐四要素 |
| 最后一天一次性提交全部代码 | 按天、按模块持续 PR |

---

## 5. 与同伴协作

```
同伴 (upstream/NuoChe)
       ↓  npm run sync:pull
   你的 feature 分支开发
       ↓  npm run pr:push → 开 PR → 合并
你的仓库 (origin/asmocen) main
```

若需将己方 PR 同步给同伴，在 PR 合并后通知对方从 `asmocen/Chat-Assistant` 拉取，或通过 upstream 约定互相同步。

---

## 6. 紧急修复（hotfix）

```bash
git checkout main
git pull origin main
git checkout -b fix/critical-bug
# 修复…
git commit -m "fix(scope): describe fix"
npm run pr:push
# 开 PR，注明原因与测试，尽快合并
```
