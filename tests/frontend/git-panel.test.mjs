/**
 * [INPUT]: 依赖 happy-dom 与 public/generated/ui.mjs Svelte 构建产物
 * [OUTPUT]: 验证常驻分支名、按需变更汇总、静默刷新并发保护、非仓库提示和 Diff 跳转
 * [POS]: tests/frontend 的 Git 状态栏与弹层交互回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { installDom } from './dom-environment.mjs';
const previewCss = await readFile(new URL('../../public/styles/preview.css', import.meta.url), 'utf8');

async function setup(api, calls = []) {
  const moduleUrl = new URL(`../../public/generated/ui.mjs?test=${Date.now()}-${Math.random()}`, import.meta.url);
  const { createGitPanel } = await import(moduleUrl);
  return createGitPanel({
    $: (selector) => document.querySelector(selector),
    api,
    ic: () => '',
    kindFromName: () => 'text',
    showDiff: (entry) => calls.push(entry),
    toast: (message) => calls.push(message),
  });
}

async function clickAndSettle(element) {
  element.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test('Git 状态栏展示分支与汇总并从文件列表打开 Diff', async () => {
  const dom = installDom(`<style>${previewCss}</style><div id="git-status-slot"></div>`);
  try {
    const calls = [];
    const panel = await setup(async () => ({
      available: true,
      isRepo: true,
      root: '/repo',
      branch: 'main',
      detached: false,
      summary: { files: 2, additions: 12, deletions: 3, binary: 0 },
      files: [
        { code: ' M', path: '/repo/a.js', relativePath: 'a.js', name: 'a.js', additions: 10, deletions: 3, binary: false, deleted: false },
        { code: '??', path: '/repo/新 文件.js', relativePath: '新 文件.js', name: '新 文件.js', additions: 2, deletions: 0, binary: false, deleted: false },
      ],
    }), calls);
    await panel.load('/repo');
    assert.match(document.querySelector('#git-summary').textContent, /main · 2 个文件 \+12 −3/);
    assert.equal(document.querySelector('#git-summary b').textContent, '+12');
    assert.equal(document.querySelector('#git-summary i').textContent, '−3');
    await clickAndSettle(document.querySelector('#git-summary'));
    assert.equal(document.querySelectorAll('.git-file').length, 2);
    assert.equal(document.querySelector('#git-popover').parentElement, document.body);
    assert.equal(getComputedStyle(document.querySelector('#git-popover')).display, 'flex');
    await clickAndSettle(document.querySelector('#git-summary'));
    assert.equal(getComputedStyle(document.querySelector('#git-popover')).display, 'none');
    await clickAndSettle(document.querySelector('#git-summary'));
    await clickAndSettle(document.body);
    assert.equal(getComputedStyle(document.querySelector('#git-popover')).display, 'none');
    await clickAndSettle(document.querySelector('#git-summary'));
    await clickAndSettle(document.querySelector('.git-file'));
    assert.equal(calls[0].path, '/repo/a.js');
    assert.equal(document.querySelector('#git-popover').classList.contains('hidden'), true);
    assert.equal(getComputedStyle(document.querySelector('#git-popover')).display, 'none');
  } finally {
    dom.cleanup();
  }
});

test('普通目录明确显示不是 Git 仓库', async () => {
  const dom = installDom(`<style>${previewCss}</style><div id="git-status-slot"></div>`);
  try {
    const panel = await setup(async () => ({ available: true, isRepo: false }));
    await panel.load('/tmp');
    assert.equal(document.querySelector('#git-status-slot').textContent, '当前目录不是 Git 仓库');
    assert.equal(document.querySelector('#git-summary'), null);
  } finally {
    dom.cleanup();
  }
});

test('干净仓库始终显示分支但隐藏零值变更汇总', async () => {
  const dom = installDom(`<style>${previewCss}</style><div id="git-status-slot"></div>`);
  try {
    const panel = await setup(async () => ({
      available: true,
      isRepo: true,
      branch: 'master',
      detached: false,
      summary: { files: 0, additions: 0, deletions: 0, binary: 0 },
      files: [],
    }));
    await panel.load('/repo');
    assert.equal(document.querySelector('.git-branch-name').textContent, 'master');
    assert.equal(document.querySelector('.git-file-count'), null);
    assert.equal(document.querySelector('#git-summary b'), null);
    assert.equal(document.querySelector('#git-summary i'), null);
  } finally {
    dom.cleanup();
  }
});

test('同目录静默刷新未完成时不会发起重叠请求', async () => {
  const dom = installDom('<div id="git-status-slot"></div>');
  try {
    let calls = 0;
    let resolveRequest;
    const pending = new Promise((resolve) => { resolveRequest = resolve; });
    const panel = await setup(() => { calls++; return pending; });
    const first = panel.refresh('/repo');
    const second = panel.refresh('/repo');
    assert.equal(calls, 1);
    resolveRequest({ available: true, isRepo: false });
    await Promise.all([first, second]);
  } finally {
    dom.cleanup();
  }
});
