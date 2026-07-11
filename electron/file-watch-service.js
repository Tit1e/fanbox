/**
 * [INPUT]: 依赖 Node.js fs/path 与 ipc-validation.js 的目录规范化能力
 * [OUTPUT]: 对外提供 createFileWatchService，管理多目录文件监听器生命周期
 * [POS]: electron 模块的文件监听领域服务，由 main.js 装配并向渲染层发送变更
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { validDirectory, normalizeWatchDirs } = require('./ipc-validation');

function createFileWatchService({ send = () => {} } = {}) {
  const watchers = new Map();
  function start(dir) {
    if (watchers.has(dir) || !fs.existsSync(dir)) return;
    try {
      const watcher = fs.watch(dir, { persistent: false, recursive: process.platform !== 'linux' }, (event, filename) => {
        const name = filename ? filename.toString() : null;
        if (name) {
          try {
            const stat = fs.statSync(path.join(dir, name));
            const now = Date.now();
            if (now - stat.mtimeMs > 3000 && now - stat.ctimeMs > 3000) return;
          } catch { /* 删除和权限变化也属于真实变更 */ }
        }
        send('fs:changed', { dir, filename: name });
      });
      watchers.set(dir, watcher);
    } catch { /* 无权限目录不影响其他监听 */ }
  }
  function set({ dirs }) {
    const wanted = new Set(normalizeWatchDirs(dirs, fs));
    for (const [dir, watcher] of watchers) {
      if (!wanted.has(dir)) { try { watcher.close(); } catch { /* */ } watchers.delete(dir); }
    }
    wanted.forEach(start);
    return { ok: true, count: watchers.size };
  }
  function watch({ dir }) {
    if (!validDirectory(dir, fs)) return { ok: false, error: '监听目录无效' };
    const resolved = path.resolve(dir);
    for (const [current, watcher] of watchers) {
      if (current !== resolved) { try { watcher.close(); } catch { /* */ } watchers.delete(current); }
    }
    start(resolved);
    return { ok: true };
  }
  function closeAll() {
    watchers.forEach((watcher) => { try { watcher.close(); } catch { /* */ } });
    watchers.clear();
  }
  return { set, watch, closeAll, count: () => watchers.size };
}

module.exports = { createFileWatchService };
