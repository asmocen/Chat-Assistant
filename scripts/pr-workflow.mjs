#!/usr/bin/env node
/**
 * PR 工作流辅助脚本
 *
 * 用法:
 *   npm run pr:new -- feature/auth-login   创建功能分支
 *   npm run pr:push                        推送当前分支（禁止 main 直推）
 *   npm run pr:check                       检查当前分支状态
 */

import { execSync } from 'node:child_process';

function run(cmd, { inherit = false } = {}) {
  if (inherit) {
    console.log(`> ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    return '';
  }
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function currentBranch() {
  return run('git branch --show-current');
}

function hasUncommittedChanges() {
  return run('git status --porcelain').length > 0;
}

function cmdNew() {
  const branchName = process.argv[3];
  if (!branchName) {
    console.error('用法: npm run pr:new -- <分支名>');
    console.error('示例: npm run pr:new -- feature/semantic-cache');
    process.exit(1);
  }

  if (hasUncommittedChanges()) {
    console.error('\n✗ 请先 commit 或 stash 未提交的更改，再创建分支。');
    process.exit(1);
  }

  console.log('\n同步 main…');
  run('git checkout main', { inherit: true });
  try {
    run('git pull origin main', { inherit: true });
  } catch {
    console.log('（跳过 pull，远程可能无更新）');
  }

  console.log(`\n创建分支: ${branchName}`);
  run(`git checkout -b ${branchName}`, { inherit: true });

  console.log('\n✓ 分支已创建。开发完成后：');
  console.log('  git add . && git commit -m "feat(scope): 说明"');
  console.log('  npm run pr:push');
  console.log('  然后在 GitHub 创建 PR → 合并到 main');
  console.log('\nPR 模板: .github/PULL_REQUEST_TEMPLATE.md');
  console.log('规范文档: docs/SUBMISSION_REQUIREMENTS.md');
}

function cmdPush() {
  const branch = currentBranch();

  if (branch === 'main') {
    console.error('\n✗ 禁止直接向 main 推送功能代码。');
    console.error('  请使用: npm run pr:new -- feature/你的功能');
    console.error('  开发后: npm run pr:push → 在 GitHub 开 PR');
    process.exit(1);
  }

  if (hasUncommittedChanges()) {
    console.error('\n✗ 存在未提交更改，请先 commit。');
    process.exit(1);
  }

  console.log(`\n推送分支 ${branch} 到 origin…`);
  run(`git push -u origin ${branch}`, { inherit: true });

  const repo = 'asmocen/Chat-Assistant';
  const compareUrl = `https://github.com/${repo}/compare/main...${branch}?expand=1`;
  console.log('\n✓ 推送完成。请创建 PR：');
  console.log(`  ${compareUrl}`);
}

function cmdCheck() {
  const branch = currentBranch();
  console.log(`\n当前分支: ${branch}`);

  if (branch === 'main') {
    console.log('⚠ 当前在 main 上。新功能请: npm run pr:new -- feature/xxx');
  } else {
    console.log('✓ 在功能分支上，可继续开发。');
  }

  if (hasUncommittedChanges()) {
    console.log('\n未提交更改:');
    run('git status -s', { inherit: true });
  } else {
    console.log('\n工作区干净。');
  }

  try {
    run('git fetch origin --quiet');
    const aheadBehind = run(`git rev-list --left-right --count origin/main...HEAD`).split(/\s+/);
    console.log(`\n相对 origin/main: 落后 ${aheadBehind[0]}，领先 ${aheadBehind[1]}`);
  } catch {
    console.log('\n无法比较 origin/main（请先 push 或检查网络）');
  }
}

const action = process.argv[2] || 'check';
const actions = { new: cmdNew, push: cmdPush, check: cmdCheck };

if (!actions[action]) {
  console.error(`未知命令: ${action}\n可用: new | push | check`);
  process.exit(1);
}

try {
  actions[action]();
} catch (err) {
  if (err.status) process.exit(err.status);
  console.error(err.message || err);
  process.exit(1);
}
