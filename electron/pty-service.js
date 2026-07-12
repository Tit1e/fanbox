/**
 * [INPUT]: 依赖 node-pty、Node.js 文件/进程能力、shell-integration.js 与 ipc-validation.js 安全契约
 * [OUTPUT]: 对外提供 createPtyService，统一管理终端、顶层命令追踪、运行任务快照和销毁
 * [POS]: electron 模块的终端领域服务，由 main.js 装配并被 IPC 处理器调用
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec, execFile } = require('child_process');
const { validPtyId, normalizeTerminalSize, validPtyInput, validDirectory } = require('./ipc-validation');
const { consumeShellMarkers } = require('./shell-integration');

function decodeLsofPath(value) {
  if (!/\\x[0-9a-fA-F]{2}/.test(value)) return value;
  const bytes = [];
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && value[i + 1] === 'x' && /^[0-9a-fA-F]{2}$/.test(value.slice(i + 2, i + 4))) {
      bytes.push(parseInt(value.slice(i + 2, i + 4), 16));
      i += 3;
    } else bytes.push(...Buffer.from(value[i], 'utf8'));
  }
  return Buffer.from(bytes).toString('utf8');
}

function termCwdByPid(pid, run = exec) {
  return new Promise((resolve) => {
    if (!pid) return resolve('');
    run(`lsof -a -p ${pid} -d cwd -Fn`, { env: { ...process.env, LC_ALL: 'en_US.UTF-8' }, timeout: 3000 }, (err, stdout) => {
      if (err) return resolve('');
      const line = (stdout || '').split('\n').find((item) => item.startsWith('n'));
      resolve(line ? decodeLsofPath(line.slice(1)) : '');
    });
  });
}

function foregroundProcessByPid(pid, run = execFile) {
  return new Promise((resolve) => {
    if (!pid || process.platform === 'win32') return resolve({ ok: false, running: false });
    run('/bin/ps', ['-o', 'pgid=', '-o', 'tpgid=', '-p', String(pid)], { timeout: 3000 }, (err, stdout) => {
      if (err) return resolve({ ok: false, running: false });
      const values = String(stdout || '').trim().split(/\s+/).map(Number);
      const [shellGroup, foregroundGroup] = values;
      if (!Number.isInteger(shellGroup) || !Number.isInteger(foregroundGroup) || foregroundGroup <= 0) {
        return resolve({ ok: false, running: false });
      }
      resolve({ ok: true, running: foregroundGroup !== shellGroup });
    });
  });
}

function createPtyService({ pty, send = () => {}, onCountChange = () => {}, foregroundProcess = foregroundProcessByPid, cwdLookup = termCwdByPid, zshIntegration = null }) {
  const terminals = new Map();
  const notifyCount = () => onCountChange(terminals.size);

  function spawn({ id, cwd, cols, rows }) {
    if (!pty) return { ok: false, error: 'node-pty 未编译，跑：npm run rebuild' };
    if (!validPtyId(id)) return { ok: false, error: '终端 ID 非法' };
    if (terminals.has(id)) return { ok: false, error: '终端 ID 已存在' };
    const shellPath = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh');
    const startCwd = validDirectory(cwd, fs) ? path.resolve(cwd) : os.homedir();
    const size = normalizeTerminalSize(cols, rows);
    const env = { ...process.env, TERM: 'xterm-256color', CODEXBOX: '1' };
    if (zshIntegration && path.basename(shellPath) === 'zsh') {
      env.ZDOTDIR = zshIntegration.dir;
      env.CODEXBOX_ORIGINAL_ZDOTDIR = zshIntegration.originalZdotdir;
    }
    delete env.CODEXBOX_PORT;
    delete env.CODEXBOX_DEV_PORT;
    delete env.CODEXBOX_NO_OPEN;
    if (!/UTF-8/i.test(env.LC_ALL || env.LC_CTYPE || env.LANG || '')) env.LANG = 'zh_CN.UTF-8';
    let terminal;
    try {
      terminal = pty.spawn(shellPath, process.platform === 'win32' ? [] : ['-l'], {
        name: 'xterm-256color', cols: size.cols, rows: size.rows, cwd: startCwd, env,
      });
    } catch (err) { return { ok: false, error: err.message }; }
    const record = { terminal, startCwd, command: '', markerState: { carry: '' } };
    terminals.set(id, record);
    notifyCount();
    terminal.onData((data) => {
      const visible = consumeShellMarkers(record.markerState, data, (marker) => {
        record.command = marker.type === 'start' && !/^\s/.test(marker.command) ? marker.command : '';
      });
      if (visible) send('pty:data', { id, data: visible });
    });
    terminal.onExit(({ exitCode }) => {
      terminals.delete(id);
      notifyCount();
      send('pty:exit', { id, exitCode });
    });
    return { ok: true, cwd: startCwd };
  }

  function input({ id, data }) {
    if (!validPtyId(id) || !validPtyInput(data)) return;
    const record = terminals.get(id);
    if (record) record.terminal.write(data);
  }

  function resize({ id, cols, rows }) {
    if (!validPtyId(id)) return;
    const record = terminals.get(id);
    if (!record) return;
    const size = normalizeTerminalSize(cols, rows);
    try { record.terminal.resize(size.cols, size.rows); } catch { /* 终端可能刚退出 */ }
  }

  function kill({ id }) {
    if (!validPtyId(id)) return;
    const record = terminals.get(id);
    if (!record) return;
    try { record.terminal.kill(); } catch { /* 终端可能刚退出 */ }
    terminals.delete(id);
    notifyCount();
  }

  async function cwd({ id }) {
    if (!validPtyId(id)) return { ok: false };
    const record = terminals.get(id);
    if (!record || !record.terminal.pid) return { ok: false };
    const value = await cwdLookup(record.terminal.pid);
    return value ? { ok: true, cwd: value } : { ok: false };
  }

  async function hasForegroundProcess({ id }) {
    if (!validPtyId(id)) return { ok: false, running: false };
    const record = terminals.get(id);
    if (!record || !record.terminal.pid) return { ok: false, running: false };
    return foregroundProcess(record.terminal.pid);
  }

  async function countRunningTasks() {
    const checks = [...terminals.values()].map(async ({ terminal }) => {
      if (!terminal.pid) return false;
      try {
        const result = await foregroundProcess(terminal.pid);
        return result.ok === true && result.running === true;
      } catch { return false; }
    });
    const results = await Promise.all(checks);
    return results.filter(Boolean).length;
  }

  async function runningTaskSnapshots() {
    const snapshots = await Promise.all([...terminals.values()].map(async (record) => {
      if (!record.terminal.pid) return null;
      try {
        const result = await foregroundProcess(record.terminal.pid);
        if (!result.ok || !result.running) return null;
        const cwdValue = await cwdLookup(record.terminal.pid);
        return { running: true, cwd: cwdValue || record.startCwd, command: record.command, title: path.basename(cwdValue || record.startCwd) || 'shell' };
      } catch { return null; }
    }));
    return snapshots.filter(Boolean);
  }

  function killAll() {
    terminals.forEach(({ terminal }) => { try { terminal.kill(); } catch { /* */ } });
    terminals.clear();
    notifyCount();
  }

  return { spawn, input, resize, kill, cwd, hasForegroundProcess, countRunningTasks, runningTaskSnapshots, killAll, count: () => terminals.size };
}

module.exports = { createPtyService, decodeLsofPath, termCwdByPid, foregroundProcessByPid };
