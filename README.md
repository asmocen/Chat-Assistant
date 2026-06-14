# AI 视觉对话助手 — cc404喵

> 看见 · 听见 · 自然回应  
> 带 Live2D 虚拟伙伴的端云协同多模态对话应用

登录后，**cc404喵** 会结合你的摄像头画面与语音，给出自然的中文回复。端侧负责感知与表达，七牛云负责帧缓存与加速，云端 LLM 负责理解生成。

## 演示视频

作品功能演示录像（百度网盘）：

- **链接**：https://pan.baidu.com/s/1xGhyEQ8bvrlFIm3_WkXP4Q?pwd=1k3h
- **提取码**：`1k3h`

演示内容涵盖：注册登录、Live2D 四态、摄像头多模态识图、语音对话、联网 Skill 与状态栏缓存统计。

## 功能特性

- **用户名 + 密码** 注册登录，安全进入对话
- Live2D 虚拟助手「cc404喵」— idle / 聆听 / 思考 / 说话 四态联动
- 实时摄像头预览，支持前后摄像头切换
- 端侧语音识别，**云端 CosyVoice TTS** 分段播报
- 多模态理解：画面 + 语音/文字
- **七牛 Kodo/KCDN** 帧缓存（**可选**，未配置时 base64 直传，见 [QINIU_SETUP.md](docs/QINIU_SETUP.md)）
- **服务端会话记忆**（刷新不丢上下文）
- **Tavily MCP 外接 + Skill 注册表**（搜索 / 网页提取 / 时间）
- **内置网页查询 Skill** 降级（Bing RSS / wttr.in）
- SSE 流式对话，首字更快
- 连续语音对话（说完自动继续听）
- 云端 STT 降级（Web Speech 不可用时）
- Token 与缓存命中实时统计

## 文档

| 文档 | 说明 |
|------|------|
| [docs/PRD.md](docs/PRD.md) | 产品需求与三天路线图 |
| [docs/CHARACTER.md](docs/CHARACTER.md) | cc404喵角色设定 |
| [docs/QINIU_SETUP.md](docs/QINIU_SETUP.md) | 七牛云从 0 搭建 |
| [docs/DESIGN.md](docs/DESIGN.md) | 技术设计与用户故事 |
| [docs/MEMORY_AND_MCP.md](docs/MEMORY_AND_MCP.md) | 服务端记忆 + MCP 联网 |
| [docs/WORK_DIVISION.md](docs/WORK_DIVISION.md) | 两人三天分工 |
| [docs/SYNC.md](docs/SYNC.md) | 本地与 GitHub 同步 |
| [docs/SUBMISSION_REQUIREMENTS.md](docs/SUBMISSION_REQUIREMENTS.md) | **作品提交要求（PR/commit 规范）** |
| [docs/PR_WORKFLOW.md](docs/PR_WORKFLOW.md) | PR 日常操作流程 |
| [docs/PR_HISTORY.md](docs/PR_HISTORY.md) | 历史 commit 与 PR 对照 |

## 协作与提交

新功能须走 **feature 分支 + Pull Request**，禁止直接向 `main` 推送。详见 [docs/SUBMISSION_REQUIREMENTS.md](docs/SUBMISSION_REQUIREMENTS.md)。

```bash
npm run pr:new -- feature/your-feature   # 创建分支
npm run pr:push                          # 推送并开 PR
```

## 快速开始

### 环境要求

- Node.js 18+
- Chrome 或 Edge（推荐）
- DashScope API Key（LLM + TTS）
- Docker（可选，用于 Tavily MCP：`npm run dev:mcp`）
- 七牛云账号（**可选**，仅帧缓存优化；见 [QINIU_SETUP.md](docs/QINIU_SETUP.md)）

### 安装

```bash
git clone https://github.com/NuoChe/Chat-Assistant.git
cd Chat-Assistant
npm install
cp .env.example .env
```

### 配置 `.env`

```env
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

JWT_SECRET=随机长字符串

QINIU_ACCESS_KEY=
QINIU_SECRET_KEY=
QINIU_BUCKET=
QINIU_CDN_DOMAIN=
# 以上四项可留空，不影响对话/联网/TTS
```

### 运行

```bash
npm run dev          # 前端 + 后端
npm run dev:all      # 前端 + 后端 + Tavily MCP（需 Docker + TAVILY_API_KEY）
npm run dev:mcp      # 仅启动 Tavily MCP Docker
```

- 前端：http://localhost:5173
- 后端：http://localhost:3001

1. 注册账号（用户名 + 密码）
2. 登录后见cc404喵
3. 点击「开始对话」，授权摄像头/麦克风
4. 直接说话即可

## 项目结构

```
Chat-Assistant/
├── client/          # React 前端（Auth、Live2D、媒体、UI）
├── server/          # Express（Auth、七牛、SSE、STT、LLM 代理）
├── docs/            # PRD、角色、七牛、设计、分工
└── .env.example
```

## License

MIT
