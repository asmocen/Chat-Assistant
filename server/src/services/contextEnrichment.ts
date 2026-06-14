import type { ChatMessage } from './llm.js';
import { buildAppearanceHint } from './imagePolicy.js';
import type { ReplyDetailMode } from './replyMode.js';
import { retrieveKnowledge } from './knowledgeRag.js';
import { getServerDatetimeContextBlock } from './serverContext.js';
import {
  isWebSearchSkillEnabled,
  needsWebSearch,
  parseWebSearchProvider,
  parseWebSearchSummary,
  runMatchingSkills,
} from '../skills/index.js';

const MEMORY_RECALL =
  /刚才|之前|上面|上次|我说过|你还记得|记得吗|之前聊|刚才说|刚才问|我前面/i;

const WEB_SEARCH_FAILURE_HINT =
  '【联网失败】未获取到与用户问题相关的联网结果。你必须如实告知「暂时没查到直接相关的信息」，禁止编造具体数据，禁止整段复述无关摘要，禁止说「让我查一下/稍等」。';

function buildMemoryRecall(history: ChatMessage[], userText: string): string | null {
  if (!MEMORY_RECALL.test(userText.trim())) return null;
  if (history.length === 0) return '（服务端会话记忆中暂无更早的对话记录）';

  const recent = history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
    .join('\n');

  return `以下是本会话近期对话记录，请据此回答用户关于「刚才/之前」的提问：\n${recent}`;
}

export interface EnrichedContext {
  knowledge: string | null;
  externalContext: string | null;
  webSearchContext: string | null;
  webSearchSucceeded: boolean;
  webSearchFailed: boolean;
  webSearchSummary: string[];
  webSearchProvider: string | null;
  memoryRecall: string | null;
  toolsUsed: string[];
}

export async function enrichContext(
  userText: string,
  history: ChatMessage[],
  replyDetailMode: ReplyDetailMode = 'brief',
): Promise<EnrichedContext> {
  const toolsUsed: string[] = ['server_datetime'];
  let knowledge = retrieveKnowledge(userText);
  const appearanceHint = buildAppearanceHint(history, userText, replyDetailMode);
  if (appearanceHint) {
    knowledge = knowledge ? `${knowledge}\n${appearanceHint}` : appearanceHint;
  }

  const memoryRecall = buildMemoryRecall(history, userText);

  const { results, toolsUsed: skillTools } = await runMatchingSkills(userText, history);

  let webSearchContext: string | null = null;
  for (const r of results) {
    if (r.toolUsed.includes('web_search') || r.toolUsed.startsWith('mcp:')) {
      webSearchContext = r.text;
      break;
    }
  }

  const webSearchAttempted = isWebSearchSkillEnabled() && needsWebSearch(userText, history);
  const webSearchSucceeded = Boolean(webSearchContext);
  const webSearchFailed = webSearchAttempted && !webSearchSucceeded;

  const contextParts: string[] = [];

  if (webSearchContext) {
    contextParts.push(webSearchContext);
    toolsUsed.push(...skillTools.filter((t) => t.includes('web_search') || t.startsWith('mcp:')));
  } else if (skillTools.length) {
    contextParts.push(...results.map((r) => r.text));
    toolsUsed.push(...skillTools);
  }

  contextParts.push(getServerDatetimeContextBlock());

  if (webSearchFailed) {
    contextParts.push(WEB_SEARCH_FAILURE_HINT);
    toolsUsed.push('web_search:failed');
  }

  if (memoryRecall) {
    contextParts.push(memoryRecall);
    if (!toolsUsed.includes('memory_recall')) toolsUsed.push('memory_recall');
  }

  return {
    knowledge,
    externalContext: contextParts.join('\n\n'),
    webSearchContext,
    webSearchSucceeded,
    webSearchFailed,
    webSearchSummary: parseWebSearchSummary(webSearchContext),
    webSearchProvider: parseWebSearchProvider(webSearchContext),
    memoryRecall,
    toolsUsed,
  };
}
