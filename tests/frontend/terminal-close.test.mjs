/**
 * [INPUT]: 依赖 happy-dom 测试环境与 public/modules/terminal.js 终端控制器
 * [OUTPUT]: 验证桌面快捷键新建终端，以及关闭活动终端的空闲直关、忙碌确认和事件绑定行为
 * [POS]: tests/frontend 的终端快捷键回归测试，保证 Cmd/Ctrl+T/W 复用终端控制器并保护运行中任务
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom, loadRendererModule } from './dom-environment.mjs';

const { createTerminalController } = await loadRendererModule('terminal');

function createController({ confirm = async () => true } = {}) {
  const killed = [];
  window.codexboxPty = { kill: (id) => killed.push(id) };
  const noop = () => {};
  const deps = new Proxy({
    $: () => null,
    state: {},
    follow: {},
    confirmDialog: confirm,
    updateWatches: noop,
  }, {
    get(target, key) { return key in target ? target[key] : noop; },
  });
  return { term: createTerminalController(deps), killed };
}

function session(id, status = 'idle') {
  return {
    id,
    status,
    xterm: { dispose() {} },
    host: { remove() {} },
  };
}

test('关闭空闲活动终端时直接复用标签关闭逻辑', async () => {
  const dom = installDom();
  try {
    const { term, killed } = createController();
    term.sessions = [session('t1'), session('t2')];
    term.active = 't2';
    term.activate = (id) => { term.active = id; };

    assert.equal(await term.closeActive(), true);
    assert.deepEqual(killed, ['t2']);
    assert.deepEqual(term.sessions.map((item) => item.id), ['t1']);
    assert.equal(term.active, 't1');
  } finally { dom.cleanup(); }
});

test('关闭忙碌终端前要求确认，取消时保留任务', async () => {
  const dom = installDom();
  try {
    let prompted = 0;
    const { term, killed } = createController({ confirm: async () => { prompted++; return false; } });
    term.sessions = [session('t1', 'busy')];
    term.active = 't1';

    assert.equal(await term.closeActive(), false);
    assert.equal(prompted, 1);
    assert.deepEqual(killed, []);
    assert.equal(term.sessions.length, 1);
  } finally { dom.cleanup(); }
});

test('忙碌终端确认期间忽略重复关闭请求', async () => {
  const dom = installDom();
  try {
    let prompted = 0;
    let resolveConfirm;
    const pendingConfirm = new Promise((resolve) => { resolveConfirm = resolve; });
    const { term } = createController({ confirm: () => { prompted++; return pendingConfirm; } });
    term.sessions = [session('t1', 'busy')];
    term.active = 't1';

    const first = term.closeActive();
    assert.equal(await term.closeActive(), false);
    assert.equal(prompted, 1);
    resolveConfirm(false);
    assert.equal(await first, false);
  } finally { dom.cleanup(); }
});

test('桌面新建与关闭事件各绑定一次并复用终端控制器', () => {
  const dom = installDom();
  try {
    let subscribed = 0;
    let newHandler;
    let closeHandler;
    window.codexboxWin = {
      onNewTerminal(cb) { subscribed++; newHandler = cb; return () => {}; },
      onCloseActiveTerminal(cb) { subscribed++; closeHandler = cb; return () => {}; },
    };
    const { term } = createController();
    let created = 0;
    let closed = 0;
    term.newTab = () => { created++; };
    term.closeActive = () => { closed++; };

    term.bindDesktopEvents();
    term.bindDesktopEvents();
    newHandler();
    closeHandler();

    assert.equal(subscribed, 2);
    assert.equal(created, 1);
    assert.equal(closed, 1);
  } finally { dom.cleanup(); }
});
