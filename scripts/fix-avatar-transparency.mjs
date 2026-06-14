/**
 * 去除 GPT 导出 PNG 中 baked 的灰白棋盘格，转为真透明。
 * 用法: node scripts/fix-avatar-transparency.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const avatarDir = path.resolve(__dirname, '../client/public/avatar');

const FILES = [
  'cc404-idle.png',
  'cc404-listening.png',
  'cc404-thinking.png',
  'cc404-speaking.png',
  'cc404-body.png',
  'octopus-clip.png',
];

function isBackgroundPixel(r, g, b, a) {
  if (a < 8) return true;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if (spread > 18) return false;
  const lum = (r + g + b) / 3;
  return lum >= 118;
}

function floodTransparent(data, w, h) {
  const visited = new Uint8Array(w * h);
  const queue = [];

  const push = (x, y) => {
    const i = y * w + x;
    if (visited[i]) return;
    const o = i * 4;
    if (!isBackgroundPixel(data[o], data[o + 1], data[o + 2], data[o + 3])) return;
    visited[i] = 1;
    queue.push(i);
  };

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  while (queue.length) {
    const i = queue.pop();
    const x = i % w;
    const y = (i - x) / w;
    data[i * 4 + 3] = 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
}

for (const file of FILES) {
  const input = path.join(avatarDir, file);
  if (!fs.existsSync(input)) {
    console.warn('skip (missing):', file);
    continue;
  }

  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const copy = Buffer.from(data);
  floodTransparent(copy, info.width, info.height);

  const backup = input.replace(/\.png$/, '.orig.png');
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(input, backup);
  }

  await sharp(copy, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(input);

  console.log('fixed:', file);
}

console.log('done');
