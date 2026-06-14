#!/usr/bin/env node
/**
 * Git 同步工具：本地 ↔ GitHub (asmocen) ↔ 上游 (NuoChe)
 *
 * 用法:
 *   npm run sync:status   查看本地与远程差异
 *   npm run sync:pull     从上游拉取同伴更新
 *   npm run sync:push     推送到你的 GitHub
 *   npm run sync          先 pull 再 push
 */

import { execSync } from 'node:child_process';

const UPSTREAM = process.env.GIT_UPSTREAM_REMOTE || 'upstream';
const ORIGIN = process.env.GIT_ORIGIN_REMOTE || 'origin';

const REMOTES = {
  [UPSTREAM]: 'https://github.com/NuoChe/Chat-Assistant.git',
  [ORIGIN]: 'https://github.com/asmocen/Chat-Assistant.git',
};

function run(cmd, { inherit = false } = {}) {
  if (inherit) {
    console.log(`> ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    return '';
  }
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function ensureRemotes() {
  const existing = run('git remote').split('\n').filter(Boolean);
  for (const [name, url] of Object.entries(REMOTES)) {
    if (!existing.includes(name)) {
      console.log(`添加远程仓库 ${name} → ${url}`);
      run(`git remote add ${name} ${url}`, { inherit: true });
    }
  }
}

function currentBranch() {
  return run('git branch --show-current');
}

function hasUncommittedChanges() {
  const status = run('git status --porcelain');
  return status.length > 0;
}

function cmdStatus() {
  ensureRemotes();
  const branch = currentBranch();
  console.log(`\n当前分支: ${branch}\n`);

  for (const remote of [UPSTREAM, ORIGIN]) {
    try {
      run(`git fetch ${remote} --quiet`);
      const aheadBehind = run(
        `git rev-list --left-right --count ${remote}/${branch}...HEAD 2>nul || git rev-list --left-right --count ${remote}/main...HEAD`,
      ).split(/\s+/);
      const behind = aheadBehind[0] ?? '?';
      const ahead = aheadBehind[1] ?? '?';
      console.log(`${remote}: 落后 ${behind} 提交，领先 ${ahead} 提交`);
    } catch {
      console.log(`${remote}: 无法比较（远程分支可能尚未创建）`);
    }
  }

  if (hasUncommittedChanges()) {
    console.log('\n⚠ 工作区有未提交更改，同步前请先 commit。');
    run('git status -s', { inherit: true });
  } else {
    console.log('\n工作区干净，可以同步。');
  }
}

function cmdPull() {
  ensureRemotes();
  const branch = currentBranch();
  console.log(`\n从 ${UPSTREAM} 拉取更新…`);
  run(`git fetch ${UPSTREAM}`, { inherit: true });
  try {
    run(`git merge ${UPSTREAM}/${branch} --no-edit`, { inherit: true });
  } catch {
    console.log(`尝试合并 ${UPSTREAM}/main …`);
    run(`git merge ${UPSTREAM}/main --no-edit`, { inherit: true });
  }
  console.log('\n✓ 拉取完成');
}

function cmdPush() {
  ensureRemotes();
  const branch = currentBranch();

  if (hasUncommittedChanges()) {
    console.error('\n✗ 存在未提交更改，请先 commit 再推送。');
    process.exit(1);
  }

  console.log(`\n推送到 ${ORIGIN}/${branch} …`);
  run(`git push -u ${ORIGIN} ${branch}`, { inherit: true });
  console.log('\n✓ 推送完成');
}

function cmdSync() {
  cmdPull();
  console.log('');
  cmdPush();
}

const action = process.argv[2] || 'sync';

const actions = {
  status: cmdStatus,
  pull: cmdPull,
  push: cmdPush,
  sync: cmdSync,
};

if (!actions[action]) {
  console.error(`未知命令: ${action}\n可用: status | pull | push | sync`);
  process.exit(1);
}

try {
  actions[action]();
} catch (err) {
  if (err.status) process.exit(err.status);
  console.error(err.message || err);
  process.exit(1);
}
