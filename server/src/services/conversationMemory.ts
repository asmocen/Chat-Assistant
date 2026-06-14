import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');
const sessionsFile = path.join(dataDir, 'sessions.json');

export interface MemoryMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

interface SessionRecord {
  sessionId: string;
  userId: number;
  username: string;
  messages: MemoryMessage[];
  updatedAt: string;
}

interface SessionStore {
  sessions: Record<string, SessionRecord>;
}

function getMemoryTurnLimit(): number {
  return Number(process.env.MEMORY_TURN_LIMIT) || 12;
}

function getMaxSessionsPerUser(): number {
  return Number(process.env.MEMORY_MAX_SESSIONS_PER_USER) || 5;
}

function ensureStore(): SessionStore {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(sessionsFile)) {
    const empty: SessionStore = { sessions: {} };
    fs.writeFileSync(sessionsFile, JSON.stringify(empty, null, 2));
    return empty;
  }
  try {
    return JSON.parse(fs.readFileSync(sessionsFile, 'utf-8')) as SessionStore;
  } catch {
    const empty: SessionStore = { sessions: {} };
    fs.writeFileSync(sessionsFile, JSON.stringify(empty, null, 2));
    return empty;
  }
}

function saveStore(store: SessionStore): void {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(sessionsFile, JSON.stringify(store, null, 2));
}

function pruneUserSessions(store: SessionStore, userId: number): void {
  const max = getMaxSessionsPerUser();
  const owned = Object.values(store.sessions)
    .filter((s) => s.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (owned.length <= max) return;

  for (const session of owned.slice(max)) {
    delete store.sessions[session.sessionId];
  }
}

export function getSession(sessionId: string): SessionRecord | undefined {
  const store = ensureStore();
  return store.sessions[sessionId];
}

export function assertSessionOwner(sessionId: string, userId: number): SessionRecord {
  const session = getSession(sessionId);
  if (!session) {
    throw new Error('会话不存在');
  }
  if (session.userId !== userId) {
    throw new Error('无权访问该会话');
  }
  return session;
}

export function getOrCreateSession(
  userId: number,
  username: string,
  sessionId?: string | null,
): { sessionId: string; messages: MemoryMessage[] } {
  const store = ensureStore();

  if (sessionId && store.sessions[sessionId]?.userId === userId) {
    const session = store.sessions[sessionId];
    return {
      sessionId,
      messages: session.messages.map(({ role, content, createdAt }) => ({
        role,
        content,
        createdAt,
      })),
    };
  }

  const newId = crypto.randomUUID();
  store.sessions[newId] = {
    sessionId: newId,
    userId,
    username,
    messages: [],
    updatedAt: new Date().toISOString(),
  };
  pruneUserSessions(store, userId);
  saveStore(store);

  return { sessionId: newId, messages: [] };
}

export function getMessages(
  sessionId: string,
  userId: number,
  limit = getMemoryTurnLimit() * 2,
): MemoryMessage[] {
  const session = assertSessionOwner(sessionId, userId);
  return session.messages.slice(-limit).map(({ role, content, createdAt }) => ({
    role,
    content,
    createdAt,
  }));
}

export function appendMessages(
  sessionId: string,
  userId: number,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): void {
  const store = ensureStore();
  const session = assertSessionOwner(sessionId, userId);
  const now = new Date().toISOString();

  for (const msg of messages) {
    session.messages.push({
      role: msg.role,
      content: msg.content,
      createdAt: now,
    });
  }

  const maxMessages = getMemoryTurnLimit() * 2;
  if (session.messages.length > maxMessages) {
    session.messages = session.messages.slice(-maxMessages);
  }

  session.updatedAt = now;
  store.sessions[sessionId] = session;
  saveStore(store);
}

export function clearSession(sessionId: string, userId: number): void {
  const store = ensureStore();
  assertSessionOwner(sessionId, userId);
  delete store.sessions[sessionId];
  saveStore(store);
}

export function getMemoryConfig() {
  return {
    turnLimit: getMemoryTurnLimit(),
    maxSessionsPerUser: getMaxSessionsPerUser(),
  };
}
