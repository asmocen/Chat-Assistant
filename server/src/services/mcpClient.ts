const MCP_TOOL_TIMEOUT_MS = 10000;

export interface McpToolDetail {
  name: string;
  description?: string;
}

let cachedTools: string[] | null = null;
let cachedToolDetails: McpToolDetail[] | null = null;
let connectPromise: Promise<boolean> | null = null;
let lastConnectError: string | null = null;
let mcpConnected = false;

let clientInstance: {
  listTools: () => Promise<{ tools: Array<{ name: string; description?: string; inputSchema?: unknown }> }>;
  callTool: (params: { name: string; arguments: Record<string, unknown> }) => Promise<unknown>;
} | null = null;

function isMcpEnabled(): boolean {
  if (process.env.MCP_ENABLED === 'false') return false;
  return Boolean(process.env.MCP_SSE_URL?.trim());
}

export function isMcpConfigured(): boolean {
  return isMcpEnabled();
}

export async function getMcpConnectionStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  tools: string[];
  toolDetails: McpToolDetail[];
  error: string | null;
}> {
  if (!isMcpEnabled()) {
    return { configured: false, connected: false, tools: [], toolDetails: [], error: null };
  }
  const ok = await connectMcp();
  return {
    configured: true,
    connected: ok && mcpConnected,
    tools: cachedTools ?? [],
    toolDetails: cachedToolDetails ?? [],
    error: ok ? null : lastConnectError,
  };
}

async function connectMcp(): Promise<boolean> {
  if (!isMcpEnabled()) return false;
  if (clientInstance && mcpConnected) return true;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    try {
      const url = process.env.MCP_SSE_URL!.trim();
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');

      const transport = new SSEClientTransport(new URL(url));
      const client = new Client({ name: 'chat-assistant', version: '1.0.0' }, { capabilities: {} });
      await client.connect(transport);
      clientInstance = {
        listTools: () => client.listTools(),
        callTool: (params) => client.callTool(params),
      };
      const tools = await clientInstance.listTools();
      cachedTools = tools.tools.map((t) => t.name);
      cachedToolDetails = tools.tools.map((t) => ({
        name: t.name,
        description: t.description,
      }));
      mcpConnected = true;
      lastConnectError = null;
      console.log('[MCP] connected, tools:', cachedTools.join(', ') || '(none)');
      return true;
    } catch (err) {
      lastConnectError = err instanceof Error ? err.message : String(err);
      console.warn('[MCP] connect failed:', lastConnectError);
      clientInstance = null;
      cachedTools = null;
      cachedToolDetails = null;
      mcpConnected = false;
      return false;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

export async function listMcpToolNames(): Promise<string[]> {
  const ok = await connectMcp();
  if (!ok || !cachedTools) return [];
  return cachedTools;
}

export function resolveMcpToolName(preferred: string[]): string | null {
  const tools = cachedTools ?? [];
  if (!tools.length) return null;

  const lower = tools.map((n) => n.toLowerCase());
  for (const name of preferred) {
    const idx = lower.indexOf(name.toLowerCase());
    if (idx >= 0) return tools[idx];
  }
  for (const name of preferred) {
    const idx = lower.findIndex((n) => n.includes(name.toLowerCase()));
    if (idx >= 0) return tools[idx];
  }
  return null;
}

function parseMcpToolResult(result: unknown): string | null {
  const r = result as { content?: Array<{ type?: string; text?: string }> };
  const parts = r?.content
    ?.filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!)
    .join('\n');
  return parts?.trim() || null;
}

export async function callMcpTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ text: string; toolName: string } | null> {
  if (!isMcpEnabled()) return null;

  const ok = await connectMcp();
  if (!ok || !clientInstance) return null;

  try {
    const result = (await Promise.race([
      clientInstance.callTool({ name: toolName, arguments: args }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('MCP tool timeout')), MCP_TOOL_TIMEOUT_MS),
      ),
    ])) as unknown;

    const text = parseMcpToolResult(result);
    if (!text) return null;
    return { text: text.slice(0, 800), toolName: `mcp:${toolName}` };
  } catch (err) {
    console.warn(`[MCP] callTool ${toolName} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function callMcpSearch(query: string): Promise<{ text: string; toolName: string } | null> {
  await connectMcp();
  const toolName =
    resolveMcpToolName(['tavily-search', 'web_search', 'search', 'web-search']) ??
    resolveMcpToolName(['tavily']);
  if (!toolName) {
    console.warn('[MCP] no search tool in:', (cachedTools ?? []).join(', ') || '(empty)');
    return null;
  }
  return callMcpTool(toolName, { query, q: query, search_query: query });
}

export async function callMcpExtract(url: string): Promise<{ text: string; toolName: string } | null> {
  await connectMcp();
  const toolName = resolveMcpToolName(['tavily-extract', 'extract', 'fetch']);
  if (!toolName) return null;
  return callMcpTool(toolName, { urls: [url], url });
}
