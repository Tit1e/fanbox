/**
 * [INPUT]: 依赖 Node.js fs/path，以 Electron userData 下的 JSON 文件持久化终端恢复记录
 * [OUTPUT]: 对外提供 createTerminalRecoveryStore，支持列出、合并、一次性取出与清空恢复命令
 * [POS]: electron 模块的终端恢复仓储，被退出守卫与恢复 IPC 共同消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function validEntry(value) {
  return value && typeof value.cwd === 'string' && path.isAbsolute(value.cwd)
    && typeof value.command === 'string' && value.command.trim() && value.command.length <= 16384;
}

function createTerminalRecoveryStore(userData, fileSystem = fs) {
  const file = path.join(userData, 'terminal-recovery.json');
  const read = () => {
    try {
      const parsed = JSON.parse(fileSystem.readFileSync(file, 'utf8'));
      return Array.isArray(parsed) ? parsed.filter(validEntry) : [];
    } catch { return []; }
  };
  const write = (entries) => {
    fileSystem.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const temp = `${file}.tmp`;
    fileSystem.writeFileSync(temp, JSON.stringify(entries, null, 2), { mode: 0o600 });
    fileSystem.renameSync(temp, file);
  };
  const list = () => read().map((entry) => ({ ...entry, available: fileSystem.existsSync(entry.cwd) }));
  const merge = (items) => {
    const now = new Date().toISOString();
    const next = read();
    for (const item of items.filter(validEntry)) {
      if (/^\s/.test(item.command)) continue;
      const duplicate = next.find((entry) => entry.cwd === item.cwd && entry.command === item.command);
      if (duplicate) duplicate.savedAt = now;
      else next.push({ id: crypto.randomUUID(), cwd: item.cwd, command: item.command, title: item.title || path.basename(item.cwd), savedAt: now });
    }
    write(next);
    return next;
  };
  const take = (ids) => {
    const wanted = new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []);
    const entries = read();
    const selected = entries.filter((entry) => wanted.has(entry.id) && fileSystem.existsSync(entry.cwd));
    write(entries.filter((entry) => !selected.some((item) => item.id === entry.id)));
    return selected;
  };
  const clear = () => write([]);
  return { list, merge, take, clear, file };
}

module.exports = { createTerminalRecoveryStore, validEntry };
