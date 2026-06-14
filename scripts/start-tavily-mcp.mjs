/**
 * 启动本地 Tavily MCP Server（Docker SSE，端口 8000）
 * 用法: node scripts/start-tavily-mcp.mjs
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');

function loadEnv() {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const apiKey = process.env.TAVILY_API_KEY?.trim();
if (!apiKey) {
  console.error('[dev:mcp] 请在 .env 中设置 TAVILY_API_KEY');
  process.exit(1);
}

const port = process.env.MCP_PORT || '8000';
const image = process.env.MCP_DOCKER_IMAGE || 'acuvity/mcp-server-tavily:0.2.12';

console.log(`[dev:mcp] 启动 ${image} → http://localhost:${port}/sse`);

const args = [
  'run',
  '--rm',
  '-p',
  `${port}:8000`,
  '-e',
  `TAVILY_API_KEY=${apiKey}`,
  image,
];

const child = spawn('docker', args, { stdio: 'inherit', shell: process.platform === 'win32' });

child.on('error', (err) => {
  console.error('[dev:mcp] 启动失败（需安装 Docker）:', err.message);
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 0));

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
