/**
 * [INPUT]: 依赖 Node.js 文件/进程能力、Codex CLI、~/.codex 会话目录和调用方路径解析器
 * [OUTPUT]: 对外提供 createCodexSessions，封装项目发现、会话检查、归档与永久删除
 * [POS]: server 模块的 Codex 会话领域服务，被主 HTTP 路由消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

function createCodexSessions({ home, platform, resolvePath, findCodexBin }) {
  const sessionsRoot = path.join(home, '.codex', 'sessions');
  const archivedRoot = path.join(home, '.codex', 'archived_sessions');
  let projectCache = { at: 0, data: null };
  const mutations = new Set();

  async function readMeta(file, bytes = 16384) {
    const fh = await fsp.open(file, 'r');
    try {
      const buf = Buffer.alloc(bytes);
      const { bytesRead } = await fh.read(buf, 0, bytes, 0);
      const head = buf.toString('utf8', 0, bytesRead);
      const cwd = head.match(/"cwd"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const id = head.match(/"(?:session_id|id)"\s*:\s*"([0-9a-f-]{36})"/i);
      if (!cwd || !id) return null;
      return { cwd: JSON.parse('"' + cwd[1] + '"'), id: id[1].toLowerCase(), file };
    } finally { await fh.close(); }
  }
  async function listFiles(root) {
    const files = [];
    const walk = async (dir) => {
      let names;
      try { names = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const name of names) {
        const file = path.join(dir, name.name);
        if (name.isDirectory()) await walk(file);
        else if (name.isFile() && name.name.endsWith('.jsonl')) files.push(file);
      }
    };
    await walk(root);
    return files;
  }
  async function forProject(projectPath, includeArchived) {
    const target = resolvePath(projectPath);
    const sources = [{ root: sessionsRoot, archived: false }];
    if (includeArchived) sources.push({ root: archivedRoot, archived: true });
    const found = new Map();
    for (const source of sources) {
      for (const file of await listFiles(source.root)) {
        try {
          const meta = await readMeta(file);
          if (meta && path.normalize(meta.cwd) === target && !found.has(meta.id)) found.set(meta.id, { ...meta, archived: source.archived });
        } catch { /* 单个损坏会话不阻塞其它会话 */ }
      }
    }
    return [...found.values()];
  }
  async function isRunning(file) {
    if (platform !== 'darwin') return false;
    return new Promise((resolve) => execFile('/usr/sbin/lsof', ['-t', file], { timeout: 3000 }, (err, stdout) => resolve(!err && !!String(stdout || '').trim())));
  }
  function snapshot(sessions) {
    return crypto.createHash('sha256').update(sessions.map((session) => session.id).sort().join('\n')).digest('hex');
  }
  async function inspectProjectSessions(projectPath, action) {
    if (action !== 'archive' && action !== 'delete') return { ok: false, error: '不支持的会话操作' };
    const sessions = await forProject(projectPath, action === 'delete');
    const running = (await Promise.all(sessions.filter((session) => !session.archived).map((session) => isRunning(session.file)))).filter(Boolean).length;
    return { ok: true, total: sessions.length, running, snapshot: snapshot(sessions) };
  }
  function runCommand(bin, action, id) {
    const args = action === 'delete' ? ['delete', '--force', id] : ['archive', id];
    return new Promise((resolve) => execFile(bin, args, { timeout: 30000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (!err) return resolve({ ok: true });
      const detail = String(stderr || stdout || err.message || '').trim().split('\n').slice(-2).join(' ');
      resolve({ ok: false, error: detail || 'Codex 命令执行失败' });
    }));
  }
  async function mutateProjectSessions(projectPath, action, expectedSnapshot) {
    if (action !== 'archive' && action !== 'delete') return { ok: false, error: '不支持的会话操作' };
    const target = resolvePath(projectPath);
    if (mutations.has(target)) return { ok: false, error: '这个项目的会话正在处理中' };
    mutations.add(target);
    try {
      const sessions = await forProject(target, action === 'delete');
      if (!sessions.length) return { ok: false, error: '没有找到可处理的 Codex 会话' };
      if (typeof expectedSnapshot !== 'string' || snapshot(sessions) !== expectedSnapshot) return { ok: false, error: '会话列表已经变化，请重新操作并确认' };
      const running = [];
      for (const session of sessions) if (!session.archived && await isRunning(session.file)) running.push(session);
      if (running.length) return { ok: false, error: `有 ${running.length} 条会话正在运行，请先结束后再操作`, running: running.length, total: sessions.length };
      const bin = await findCodexBin();
      if (!bin) return { ok: false, error: '没找到 codex 命令' };
      const failures = [];
      let succeeded = 0;
      for (const session of sessions) {
        const result = await runCommand(bin, action, session.id);
        if (result.ok) succeeded++;
        else failures.push(result.error);
      }
      if (succeeded) projectCache = { at: 0, data: null };
      return { ok: failures.length === 0, total: sessions.length, succeeded, failed: failures.length, error: failures.length ? `成功 ${succeeded} 条，失败 ${failures.length} 条：${failures[0]}` : undefined };
    } finally { mutations.delete(target); }
  }
  async function projects(force = false) {
    if (!force && projectCache.data && Date.now() - projectCache.at < 60000) return projectCache.data;
    const cutoff = Date.now() - 30 * 86400000;
    const map = new Map();
    const files = [];
    for (const file of await listFiles(sessionsRoot)) {
      try { const stat = await fsp.stat(file); if (stat.mtimeMs >= cutoff) files.push({ file, mtimeMs: stat.mtimeMs }); } catch { /* 文件变化时跳过 */ }
    }
    files.sort((a, b) => b.mtimeMs - a.mtimeMs);
    await Promise.all(files.slice(0, 40).map(async ({ file, mtimeMs }) => {
      try {
        const meta = await readMeta(file);
        if (meta && meta.cwd && meta.cwd !== home) map.set(meta.cwd, Math.max(map.get(meta.cwd) || 0, mtimeMs));
      } catch { /* 没用过 Codex 或单条损坏 */ }
    }));
    const result = [];
    for (const [cwd, lastActive] of [...map.entries()].sort((a, b) => b[1] - a[1])) {
      if (result.length >= 12) break;
      try { if ((await fsp.stat(cwd)).isDirectory()) result.push({ path: cwd, name: path.basename(cwd), lastActive }); } catch { /* 已删除项目跳过 */ }
    }
    const data = { ok: true, projects: result };
    projectCache = { at: Date.now(), data };
    return data;
  }

  return { codexProjects: projects, inspectCodexProjectSessions: inspectProjectSessions, mutateCodexProjectSessions: mutateProjectSessions };
}

module.exports = { createCodexSessions };
