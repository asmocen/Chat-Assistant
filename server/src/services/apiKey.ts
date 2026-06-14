const PLACEHOLDER_KEY_PATTERN = /your_|change-me|example|here$/i;

export function getOpenAiApiKey(): string | undefined {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || PLACEHOLDER_KEY_PATTERN.test(key)) return undefined;
  return key;
}

export function isOpenAiApiKeyConfigured(): boolean {
  return Boolean(getOpenAiApiKey());
}
