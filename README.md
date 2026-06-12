# AI 视觉对话助手 (Chat Assistant)

一款端云协同的多模态 AI 对话应用：打开摄像头与麦克风，让 AI **看见**画面、**听见**语音，并给出自然的中文回应。

## 功能特性

- 📷 实时摄像头预览（本地渲染，不上传视频流）
- 🎤 端侧语音识别（Web Speech API，零 API 成本）
- 👁️ 多模态理解：结合画面 + 语音/文字与 AI 对话
- 🔊 AI 语音播报（可开关）
- 💰 端云协同成本控制：按需抓拍、图像压缩、场景去重、限流
- 📊 实时 Token 用量统计

## 快速开始

### 环境要求

- Node.js 18+
- Chrome 或 Edge 浏览器（需支持 Web Speech API）
- OpenAI 兼容 API Key（OpenAI / 通义千问 / DeepSeek 等）

### 安装

```bash
git clone https://github.com/NuoChe/Chat-Assistant.git
cd Chat-Assistant
npm install
```

### 配置

复制环境变量模板并填入 API Key：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

> 若使用通义千问，可设置：
> `OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`
> `OPENAI_MODEL=qwen-vl-plus`

### 运行

```bash
npm run dev
```

- 前端：http://localhost:5173
- 后端：http://localhost:3001

点击「开始对话」，允许摄像头/麦克风权限，直接说话即可。

## 项目结构

```
Chat-Assistant/
├── client/                 # React 前端（端侧）
│   └── src/
│       ├── hooks/          # 媒体流、语音识别、语音合成
│       ├── lib/            # 帧采集、API 调用
│       └── components/     # UI 组件
├── server/                 # Express 后端（云端代理）
│   └── src/routes/chat.ts  # 多模态 API 代理
├── docs/
│   └── DESIGN.md           # 设计文档（用户故事 & 成本控制）
└── .env.example
```

## 成本控制策略

详见 [docs/DESIGN.md](docs/DESIGN.md)，核心策略：

| 策略 | 说明 |
|------|------|
| 端侧 STT/TTS | 语音识别与合成在浏览器完成，零云端费用 |
| 按需抓拍 | 仅在用户说完话时抓取一帧，非持续视频上传 |
| 图像压缩 | 缩至 512px + JPEG 0.65 |
| 场景去重 | 画面未变化时跳过图片上传 |
| 低精度视觉 | API `detail: low` 模式 |
| 限流 | 服务端每分钟最多 10 次请求 |

## 生产部署

```bash
npm run build
npm start
```

将 `client/dist` 静态文件交由 Express 托管，或前后端分开部署。

## 设计文档

完整的设计说明（用户故事对比、成本控制技巧对比）见：

👉 **[docs/DESIGN.md](docs/DESIGN.md)**

## License

MIT
