export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  sentImage: boolean;
}

export async function sendChat(params: {
  text: string;
  imageBase64?: string;
  history: ChatMessage[];
  skipImage?: boolean;
}): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data;
}

export async function checkHealth(): Promise<{ status: string; hasApiKey: boolean; model: string }> {
  const res = await fetch('/api/health');
  return res.json();
}
