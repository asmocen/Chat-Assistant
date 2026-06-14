const TOKEN_KEY = 'chat_token';
const USERNAME_KEY = 'chat_username';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredAuth(token: string, username: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

export function getStoredUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

export function useAuthMock(): boolean {
  return import.meta.env.VITE_USE_AUTH_MOCK === 'true';
}

export function useStreamMock(): boolean {
  return import.meta.env.VITE_USE_STREAM_MOCK === 'true';
}

async function authMockFetch(path: string, init?: RequestInit): Promise<Response> {
  const body = init?.body ? JSON.parse(init.body as string) : {};
  const method = init?.method ?? 'GET';

  if (path === '/auth/register' && method === 'POST') {
    const { username, password } = body;
    if (!username || !password) {
      return jsonResponse(400, { error: '请填写用户名和密码' });
    }
    if (password.length < 6) {
      return jsonResponse(400, { error: '密码至少 6 位' });
    }
    const token = `mock-jwt-${username}`;
    return jsonResponse(201, { token, username });
  }

  if (path === '/auth/login' && method === 'POST') {
    const { username, password } = body;
    if (!username || !password) {
      return jsonResponse(400, { error: '请填写用户名和密码' });
    }
    if (password.length < 6) {
      return jsonResponse(401, { error: '用户名或密码错误' });
    }
    return jsonResponse(200, { token: `mock-jwt-${username}`, username });
  }

  if (path === '/auth/me' && method === 'GET') {
    const auth = init?.headers as Record<string, string> | undefined;
    const header = auth?.Authorization ?? auth?.authorization ?? '';
    const token = header.replace('Bearer ', '');
    if (!token.startsWith('mock-jwt-')) {
      return jsonResponse(401, { error: '请先登录' });
    }
    const username = token.slice('mock-jwt-'.length);
    return jsonResponse(200, { username, userId: 1 });
  }

  return jsonResponse(404, { error: 'Mock 未实现: ' + path });
}

function jsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  if (useAuthMock() && path.startsWith('/auth')) {
    return authMockFetch(path, init);
  }

  const token = getStoredToken();
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(`/api${path}`, { ...init, headers });
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamMeta {
  kodoHit: boolean;
  semanticHit: boolean;
  sentImage: boolean;
  imageUrl?: string | null;
}

export interface StreamCallbacks {
  onMeta?: (meta: StreamMeta) => void;
  onChunk?: (text: string) => void;
  onDone?: (reply: string, usage?: { total_tokens?: number }) => void;
  onError?: (error: string) => void;
}

export async function streamChat(
  params: {
    text: string;
    imageBase64?: string;
    history: ChatMessage[];
    skipImage?: boolean;
  },
  callbacks: StreamCallbacks,
): Promise<void> {
  if (useStreamMock()) {
    await mockStream(params.text, callbacks);
    return;
  }

  const res = await authFetch('/chat/stream', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    callbacks.onError?.(data.error || `请求失败 (${res.status})`);
    return;
  }

  if (!res.body) {
    callbacks.onError?.('无响应流');
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      if (!block.trim()) continue;
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data = line.slice(5).trim();
      }
      if (!data) continue;
      try {
        const parsed = JSON.parse(data);
        if (event === 'meta') callbacks.onMeta?.(parsed);
        else if (event === 'chunk') callbacks.onChunk?.(parsed.text ?? '');
        else if (event === 'done') callbacks.onDone?.(parsed.reply ?? '', parsed.usage);
        else if (event === 'error') callbacks.onError?.(parsed.error ?? '未知错误');
      } catch {
        /* ignore */
      }
    }
  }
}

async function mockStream(text: string, callbacks: StreamCallbacks): Promise<void> {
  callbacks.onMeta?.({ kodoHit: false, semanticHit: false, sentImage: false });
  const reply = `嗨！我是 cc404喵～你刚才说的是「${text.slice(0, 20)}」对吧？`;
  for (const ch of reply) {
    await sleep(40);
    callbacks.onChunk?.(ch);
  }
  callbacks.onDone?.(reply, { total_tokens: 42 });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function checkHealth(): Promise<{
  status: string;
  hasApiKey: boolean;
  model: string;
  qiniuConfigured?: boolean;
}> {
  const res = await fetch('/api/health');
  return res.json();
}

export async function loginApi(username: string, password: string) {
  const res = await authFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '登录失败');
  return data as { token: string; username: string };
}

export async function registerApi(username: string, password: string) {
  const res = await authFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '注册失败');
  return data as { token: string; username: string };
}

export async function meApi(): Promise<{ username: string; userId: number }> {
  const res = await authFetch('/auth/me');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '未登录');
  return data;
}
