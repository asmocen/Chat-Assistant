import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const usersFile = path.join(dataDir, 'users.json');

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

interface UserStore {
  nextId: number;
  users: UserRow[];
}

function ensureStore(): UserStore {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(usersFile)) {
    const empty: UserStore = { nextId: 1, users: [] };
    fs.writeFileSync(usersFile, JSON.stringify(empty, null, 2));
    return empty;
  }
  return JSON.parse(fs.readFileSync(usersFile, 'utf-8')) as UserStore;
}

function saveStore(store: UserStore): void {
  fs.writeFileSync(usersFile, JSON.stringify(store, null, 2));
}

export function findUserByUsername(username: string): UserRow | undefined {
  const store = ensureStore();
  return store.users.find((u) => u.username === username);
}

export function createUser(username: string, passwordHash: string): UserRow {
  const store = ensureStore();
  if (store.users.some((u) => u.username === username)) {
    throw new Error('用户名已被注册');
  }
  const user: UserRow = {
    id: store.nextId++,
    username,
    password_hash: passwordHash,
    created_at: new Date().toISOString(),
  };
  store.users.push(user);
  saveStore(store);
  return user;
}
