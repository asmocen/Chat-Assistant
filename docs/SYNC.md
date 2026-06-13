# 代码同步指南

本地项目与两个 GitHub 远程仓库保持同步：

| 远程名 | 地址 | 用途 |
|--------|------|------|
| `origin` | [asmocen/Chat-Assistant](https://github.com/asmocen/Chat-Assistant) | **你的仓库**，推送个人/团队更新 |
| `upstream` | [NuoChe/Chat-Assistant](https://github.com/NuoChe/Chat-Assistant) | **同伴仓库**，拉取上游更新 |

## 首次设置

1. 在 GitHub 创建空仓库：[https://github.com/new](https://github.com/new)  
   - Owner: `asmocen`  
   - Repository name: `Chat-Assistant`  
   - 不要勾选「Add a README」（本地已有代码）

2. 确认远程配置：

```bash
git remote -v
# origin    https://github.com/asmocen/Chat-Assistant.git
# upstream  https://github.com/NuoChe/Chat-Assistant.git
```

3. 提交本地更改后首次推送：

```bash
git add .
git commit -m "你的提交说明"
npm run sync:push
```

## 日常同步命令

```bash
# 查看本地与远程差异
npm run sync:status

# 从同伴仓库拉取更新
npm run sync:pull

# 推送到你的 GitHub
npm run sync:push

# 先拉取再推送（推荐）
npm run sync
```

Windows 也可直接运行：

```powershell
.\scripts\sync.ps1 status
.\scripts\sync.ps1 pull
.\scripts\sync.ps1 push
.\scripts\sync.ps1 sync
```

## 推荐工作流

```
同伴更新 (upstream)
       ↓  npm run sync:pull
   本地开发 + commit
       ↓  npm run sync:push
你的仓库 (origin / asmocen)
```

## 注意事项

- 同步前确保工作区已 `commit`，未提交更改时 `sync:push` 会拒绝执行
- `.env` 已在 `.gitignore` 中，不会上传到 GitHub
- 若 `upstream` 与本地冲突，需手动解决后再 `git commit` 并推送
