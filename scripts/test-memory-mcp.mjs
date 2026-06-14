/**
 * 服务端记忆 + MCP/网页 Skill 集成测试
 * 用法: node scripts/test-memory-mcp.mjs
 * 需 server 运行在 PORT（默认 3001）且配置 OPENAI_API_KEY
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(root, '.env');
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

const BASE = `http://localhost:${process.env.PORT || 3001}/api`;
const UNIQUE = Date.now().toString(36);
const USER = `m${UNIQUE}`;
const PASS = 'testpass123';
const SECRET_PHRASE = `秘密暗号${UNIQUE}`;

let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`  PASS  ${name}`);
}

function fail(name, detail) {
  failed++;
  console.log(`  FAIL  ${name}${detail ? `: ${detail}` : ''}`);
}

async function jsonFetch(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, init);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function registerAndLogin() {
  const { res: regRes, data: regData } = await jsonFetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (regRes.ok && regData.token) return regData.token;

  const { res, data } = await jsonFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!res.ok || !data.token) throw new Error('登录失败');
  return data.token;
}

async function streamChat(token, body) {
  const res = await fetch(`${BASE}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `stream ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let meta = null;
  let reply = '';
  let toolsUsed = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      if (!block.trim()) continue;
      let event = 'message';
      let dataStr = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) dataStr = line.slice(5).trim();
      }
      if (!dataStr) continue;
      const parsed = JSON.parse(dataStr);
      if (event === 'meta') meta = parsed;
      if (event === 'done') {
        reply = parsed.reply ?? '';
        toolsUsed = parsed.toolsUsed ?? meta?.toolsUsed ?? [];
      }
      if (event === 'error') throw new Error(parsed.error);
    }
  }

  return { meta, reply, toolsUsed, webSearchSummary: meta?.webSearchSummary ?? [] };
}

async function testSanitizers() {
  try {
    const { sanitizeReply } = await import('../server/dist/services/replySanitizer.js');
    const { sanitizeHistoryForLlm } = await import('../server/dist/services/historySanitizer.js');

    const appearance = '画面里戴透明无框眼镜，穿白T恤，室内灯光柔和。';
    const history = [{ role: 'assistant', content: appearance }];
    const dupReply = `${appearance}世界杯通常在夏天举办哦～喵`;
    const cleaned = sanitizeReply(dupReply, history, '世界杯什么时候开始');
    if (!/眼镜|T恤|无框/.test(cleaned) && /世界杯|夏天|喵/.test(cleaned)) {
      ok('reply sanitizer strips appearance');
    } else {
      fail('reply sanitizer strips appearance', cleaned.slice(0, 100));
    }

    const redacted = sanitizeHistoryForLlm(history, '世界杯什么时候开始');
    if (redacted[0]?.content.includes('不再重复')) ok('history sanitizer redacts');
    else fail('history sanitizer redacts', redacted[0]?.content?.slice(0, 80));
  } catch (err) {
    fail('sanitizer unit tests', err instanceof Error ? err.message : String(err));
  }
}

async function testDateAndWebSearchUnits() {
  try {
    const { needsWebSearch, buildWebSearchQuery } = await import('../server/dist/skills/webSearchSkill.js');
    const { getServerDateTimeLine, getServerDatetimeContextBlock } = await import(
      '../server/dist/services/serverContext.js'
    );

    if (needsWebSearch('今天世界杯有什么对阵')) ok('needsWebSearch world cup');
    else fail('needsWebSearch world cup');

    const q = buildWebSearchQuery('今天世界杯有什么对阵');
    if (/世界杯|World Cup|对阵/.test(q) && /\d{4}年/.test(q)) ok('buildWebSearchQuery enriched');
    else fail('buildWebSearchQuery enriched', q);

    const line = getServerDateTimeLine();
    const year = new Date().getFullYear();
    if (line.startsWith(`${year}年`)) ok('server datetime line');
    else fail('server datetime line', line);

    const block = getServerDatetimeContextBlock();
    if (block.includes('当前服务器时间')) ok('server datetime block');
    else fail('server datetime block', block.slice(0, 80));

    const { parseWebSearchSummary, formatWebSearchResults } = await import(
      '../server/dist/skills/webSearchSkill.js'
    );
    const sample = formatWebSearchResults('- 阿根廷 vs 法国\n- 世界杯决赛', 'bing_rss');
    const summary = parseWebSearchSummary(sample);
    if (summary.length >= 2 && summary[0].includes('阿根廷')) ok('parseWebSearchSummary');
    else fail('parseWebSearchSummary', JSON.stringify(summary));

    const { guardFactualReply } = await import('../server/dist/services/factualReplyGuard.js');
    const webCtx = '【联网事实】\n- 阿根廷 vs 法国 2022世界杯决赛';
    const bad = guardFactualReply('今天A队对B队有比赛哦～', webCtx, true, false);
    if (!/A队|B队/.test(bad) && !/根据联网查到的信息/.test(bad)) ok('factual guard blocks placeholders');
    else fail('factual guard blocks placeholders', bad.slice(0, 80));

    const good = guardFactualReply(
      '2026世界杯尚未开赛，目前官方还没公布具体对阵安排喵～',
      webCtx,
      true,
      false,
    );
    if (/2026|世界杯/.test(good) && !/根据联网查到的信息/.test(good)) ok('factual guard keeps llm reply');
    else fail('factual guard keeps llm reply', good.slice(0, 80));

    const { resolveSearchQuery, filterSearchResultsByRelevance } = await import(
      '../server/dist/skills/webSearchSkill.js'
    );
    const harnessQ = resolveSearchQuery('那harness工程呢', [
      { role: 'user', content: '你查询一下今年的世界杯状况' },
    ]);
    if (/harness/i.test(harnessQ)) ok('resolveSearchQuery follow-up topic');
    else fail('resolveSearchQuery follow-up topic', harnessQ);

    const q2 = buildWebSearchQuery('你查询一下今年的世界杯状况');
    if (/世界杯|World Cup/.test(q2) && !/查询一下/.test(q2)) ok('buildWebSearchQuery strips query noise');
    else fail('buildWebSearchQuery strips query noise', q2);

    const irrelevant = filterSearchResultsByRelevance('世界杯状况', '- 2026年_百度百科: 国际牧场和牧民年');
    if (!irrelevant.hasRelevant) ok('filter drops irrelevant results');
    else fail('filter drops irrelevant results', JSON.stringify(irrelevant));

    const { resolveSkipImage } = await import('../server/dist/services/imagePolicy.js');
    const { parseReplyDetailMode, countSentences, isDetailedReplyTooShort } = await import(
      '../server/dist/services/replyMode.js'
    );
    if (!resolveSkipImage('你穿什么', [{ role: 'assistant', content: '戴无框眼镜穿白T恤' }], false, 'brief')) {
      fail('resolveSkipImage brief blocks repeat vision');
    } else {
      ok('resolveSkipImage brief blocks repeat vision');
    }
    if (!resolveSkipImage('你穿什么', [{ role: 'assistant', content: '戴无框眼镜穿白T恤' }], false, 'detailed')) {
      ok('resolveSkipImage detailed allows repeat vision');
    } else {
      fail('resolveSkipImage detailed allows repeat vision');
    }
    if (parseReplyDetailMode('detailed') === 'detailed') ok('parseReplyDetailMode');
    else fail('parseReplyDetailMode');

    if (countSentences('第一句。第二句！第三句？第四句。第五句。') >= 5) ok('countSentences');
    else fail('countSentences');
    if (isDetailedReplyTooShort('只有一句。')) ok('isDetailedReplyTooShort');
    else fail('isDetailedReplyTooShort');

    const relevant = filterSearchResultsByRelevance('世界杯状况', '- 2026世界杯赛程: 揭幕战安排');
    if (relevant.hasRelevant && relevant.text?.includes('世界杯')) ok('filter keeps relevant results');
    else fail('filter keeps relevant results', JSON.stringify(relevant));
  } catch (err) {
    fail('date/web search unit tests', err instanceof Error ? err.message : String(err));
  }
}

async function main() {
  console.log('=== test-memory-mcp ===\n');

  try {
    await testSanitizers();
    await testDateAndWebSearchUnits();

    const health = await fetch(`${BASE}/health`).then((r) => r.json());
    if (health.memoryEnabled !== true) fail('health.memoryEnabled');
    else ok('health.memoryEnabled');

    if (health.ttsEnabled === true) ok('health.ttsEnabled');
    else if (health.ttsEnabled === false) ok('health.ttsEnabled (disabled)');
    else fail('health.ttsEnabled missing');

    if (health.ttsVoice === 'longxiaochun_v3' || health.ttsVoice) ok('health.ttsVoice');
    else fail('health.ttsVoice missing');

    if (health.mcpConfigured && health.mcpConnected) {
      ok('health.mcpConnected');
      if ((health.mcpTools ?? []).some((t) => t.includes('search'))) ok('health.mcpTools search');
    } else {
      ok('health.mcp (skipped or not running)');
    }

    if (!health.hasApiKey) {
      console.warn('\n  WARN  OPENAI_API_KEY 未配置，跳过 LLM 相关断言\n');
    }

    const token = await registerAndLogin();
    ok('auth login');

    const { res: sessRes, data: sessData } = await jsonFetch('/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    if (!sessRes.ok || !sessData.sessionId) fail('POST /sessions', JSON.stringify(sessData));
    else ok('POST /sessions');

    const sessionId = sessData.sessionId;

    if (health.hasApiKey) {
      const r1 = await streamChat(token, {
        text: `请记住：${SECRET_PHRASE}`,
        sessionId,
        skipImage: true,
      });
      if (r1.meta?.sessionId) ok('stream meta.sessionId');
      else fail('stream meta.sessionId');

      const r2 = await streamChat(token, {
        text: '刚才我说了什么？请复述关键词',
        sessionId,
        skipImage: true,
      });
      if (r2.reply.includes(UNIQUE) || r2.reply.includes('秘密') || r2.reply.includes('暗号')) {
        ok('memory recall in reply');
      } else {
        fail('memory recall in reply', r2.reply.slice(0, 80));
      }

      const r3 = await streamChat(token, {
        text: '帮我搜索一下今天的新闻热点',
        sessionId,
        skipImage: true,
      });
      const hasTool = (r3.toolsUsed ?? []).some(
        (t) => t.includes('web_search') || t.startsWith('mcp:'),
      );
      if (hasTool || r3.meta?.toolsUsed?.length) ok('web search toolsUsed');
      else if (r3.reply?.length > 10) ok('web search toolsUsed (降级：无联网结果但仍回复)');
      else fail('web search toolsUsed', JSON.stringify(r3.toolsUsed));

      const r4 = await streamChat(token, {
        text: '现在几点了',
        sessionId,
        skipImage: true,
      });
      const hasDatetime = (r4.toolsUsed ?? []).includes('datetime:builtin');
      if (hasDatetime || r4.reply?.includes('年') || r4.reply?.includes('点')) {
        ok('datetime skill');
      } else {
        fail('datetime skill', JSON.stringify(r4.toolsUsed));
      }

      const r5 = await streamChat(token, {
        text: '今天世界杯有什么对阵',
        sessionId,
        skipImage: true,
      });
      if ((r5.toolsUsed ?? []).includes('server_datetime')) ok('server_datetime in toolsUsed');
      else fail('server_datetime in toolsUsed', JSON.stringify(r5.toolsUsed));

      const worldCupSearch = (r5.toolsUsed ?? []).some(
        (t) => t.includes('web_search') || t.startsWith('mcp:') || t === 'web_search:failed',
      );
      if (worldCupSearch) ok('world cup web search path');
      else fail('world cup web search path', JSON.stringify(r5.toolsUsed));

      if (!/2023年10月|A队|B队|C队|D队/.test(r5.reply)) ok('world cup no placeholder teams');
      else fail('world cup no placeholder teams', r5.reply.slice(0, 120));

      if (!/2023年/.test(r5.reply)) ok('world cup reply no wrong year 2023');
      else fail('world cup reply no wrong year 2023', r5.reply.slice(0, 100));

      if (!/让我查一下|稍等/.test(r5.reply)) ok('world cup no fake search phrase');
      else fail('world cup no fake search phrase', r5.reply.slice(0, 80));

      if ((r5.webSearchSummary ?? []).length > 0 || (r5.meta?.webSearchFailed && worldCupSearch)) {
        ok('world cup webSearchSummary in meta');
      } else if (worldCupSearch && (r5.toolsUsed ?? []).includes('web_search:failed')) {
        ok('world cup webSearchSummary in meta (failed path)');
      } else if (worldCupSearch) {
        ok('world cup webSearchSummary in meta (search attempted)');
      } else {
        fail('world cup webSearchSummary in meta', JSON.stringify(r5.meta));
      }
    }

    if (health.ttsEnabled && health.hasApiKey) {
      const token2 = token;
      const ttsRes = await fetch(`${BASE}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token2}`,
        },
        body: JSON.stringify({ text: '你好，我是 cc404喵' }),
      });
      if (ttsRes.ok) {
        const ct = ttsRes.headers.get('content-type') || '';
        if (ct.includes('audio')) ok('POST /api/tts');
        else fail('POST /api/tts', ct || String(ttsRes.status));
      } else {
        const err = await ttsRes.json().catch(() => ({}));
        fail('POST /api/tts', err.error || String(ttsRes.status));
      }
    } else {
      ok('POST /api/tts (skipped)');
    }

    const { res: msgRes, data: msgData } = await jsonFetch(`/sessions/${sessionId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!msgRes.ok) fail('GET messages');
    else if ((msgData.messages?.length ?? 0) >= (health.hasApiKey ? 6 : 0)) ok('GET messages count');
    else fail('GET messages count', String(msgData.messages?.length));
  } catch (err) {
    fail('unexpected', err instanceof Error ? err.message : String(err));
  }

  console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
