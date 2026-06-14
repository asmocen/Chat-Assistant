# cc404喵 立绘素材规范（L2 Pixi 方案）

> Live2D 模式下使用 Pixi.js 渲染四态 PNG + 可选章鱼发卡叠加层。详见 [CHARACTER.md](./CHARACTER.md)。

## 文件清单

| 文件 | 要求 |
|------|------|
| `client/public/avatar/cc404-idle.png` | 待机，**不要画章鱼**（或保留 baked 并关闭叠加层） |
| `cc404-listening.png` | 聆听，耳麦亮/前倾，头部位置与 idle 一致 |
| `cc404-thinking.png` | 思考，托腮 |
| `cc404-speaking.png` | 说话，张嘴 |
| `octopus-clip.png` | 透明底，仅暖橙 Q 版章鱼发卡 |
| `cc404-body.png` | Fallback 用，**可含 baked 章鱼** |

## 后处理

```bash
node scripts/fix-avatar-transparency.mjs
```

去除 GPT 导出 PNG 中的灰白棋盘格背景。

## GPT 生图提示词（四态 body）

```
二次元猫耳少女 cc404喵，活泼开朗，科技耳麦，蓝白暖橙配色，
透明背景，半身立绘，动漫风。
头顶侧边预留小章鱼发卡位置，本图不要画章鱼。
[状态：待机 / 聆听前倾 / 思考托腮 / 说话张嘴]
四张构图一致，头部大小与位置对齐。
```

## GPT 生图提示词（章鱼发卡）

```
Claude Code 风格暖橙色 Q 版小章鱼发卡，圆头短触须 2-4 根，
透明背景，单独素材，占画面约 15%，无人物。
```

## 叠加层开关

在 [client/src/lib/avatarAssets.ts](../client/src/lib/avatarAssets.ts)：

- `USE_OCTOPUS_OVERLAY = false`：四态 PNG 已含发卡（当前默认）
- `USE_OCTOPUS_OVERLAY = true`：四态 PNG 无章鱼，由 [avatarLayout.ts](../client/src/lib/avatarLayout.ts) 校准 `octopus-clip.png` 位置

## L3 真 Live2D

见 [CHARACTER.md §9](./CHARACTER.md) 与 [DESIGN.md §8](./DESIGN.md)。
