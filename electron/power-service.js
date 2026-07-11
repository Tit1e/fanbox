/**
 * [INPUT]: 依赖调用方注入的平台、系统休眠切换、配置持久化与状态变更通知
 * [OUTPUT]: 对外提供 createLidGuard，管理合盖运行意图、终端计数和系统生效状态
 * [POS]: electron 模块的电源状态领域服务，由 main.js 装配且可在 Node 环境独立测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

function createLidGuard({ platform, setDisableSleep, persist = () => {}, onChange = () => {} }) {
  let intent = false;
  let active = false;

  function notify() { onChange({ intent, active }); }

  function refresh(terminalCount) {
    if (platform !== 'darwin') return { intent, active };
    const wanted = intent && terminalCount > 0;
    if (wanted === active) return { intent, active };
    const changed = setDisableSleep(wanted);
    if (wanted && !changed) {
      intent = false;
      persist(false);
    }
    active = wanted && changed;
    notify();
    return { intent, active };
  }

  function restore(savedIntent, terminalCount = 0) {
    intent = platform === 'darwin' && !!savedIntent;
    notify();
    return refresh(terminalCount);
  }

  function setIntent(value, terminalCount = 0) {
    intent = platform === 'darwin' && !!value;
    persist(intent);
    notify();
    return refresh(terminalCount);
  }

  function shutdown() {
    if (platform === 'darwin' && active) setDisableSleep(false);
    active = false;
    notify();
  }

  return { refresh, restore, setIntent, shutdown, state: () => ({ intent, active }) };
}

module.exports = { createLidGuard };
