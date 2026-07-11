/**
 * [INPUT]: 依赖 happy-dom 与 public/generated/ui.mjs Svelte 构建产物
 * [OUTPUT]: 验证仓库汇总、非仓库提示、变更文件列表和 Diff 跳转
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
