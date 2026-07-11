/**
 * [INPUT]: 依赖 Node.js 文件/进程能力、路径服务和文件类型规则
 * [OUTPUT]: 对外提供 createBrowserService，封装目录浏览、文件读取、模糊搜索与全文搜索
 * [POS]: server 模块的只读文件浏览与搜索领域服务，被主 HTTP 路由消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

const fsp = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');

function createBrowserService({ platform, resolvePath, kindOf, projectOf, ext, ignoreDirs }) {
  async function listDir(dirPath) {
    const dir = resolvePath(dirPath);
    const dirents = await fsp.readdir(dir, { withFileTypes: true });
    const entries = [];
    for (const d of dirents) {
      if (d.name === '.DS_Store') continue;
      const full = path.join(dir, d.name);
      let isDir = d.isDirectory();
      if (d.isSymbolicLink()) { try { isDir = (await fsp.stat(full)).isDirectory(); } catch { continue; } }
      let size = 0, mtime = 0, btime = 0;
      try { const stat = await fsp.lstat(full); size = stat.size; mtime = stat.mtimeMs; btime = stat.birthtimeMs || 0; } catch { /* 条目消失时保留零值 */ }
      entries.push({ name: d.name, path: full, isDir, kind: kindOf(d.name, isDir), hidden: d.name.startsWith('.'), size, mtime, btime });
    }
    entries.sort((a, b) => a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name, 'zh', { numeric: true }));
    const project = projectOf(new Set(entries.map((entry) => entry.name)));
    const subDirs = entries.filter((entry) => entry.isDir && !entry.name.startsWith('.'));
    if (subDirs.length <= 80) await Promise.all(subDirs.map(async (entry) => {
      try { entry.project = projectOf(new Set(await fsp.readdir(entry.path))); } catch { /* 无权限目录跳过 */ }
    }));
    const parts = dir.split(path.sep).filter(Boolean);
    const breadcrumb = [{ name: platform === 'win32' ? dir.split(path.sep)[0] : '/', path: platform === 'win32' ? parts[0] + path.sep : path.sep }];
    let acc = platform === 'win32' ? parts[0] + path.sep : path.sep;
    for (let i = platform === 'win32' ? 1 : 0; i < parts.length; i++) { acc = path.join(acc, parts[i]); breadcrumb.push({ name: parts[i], path: acc }); }
    return { path: dir, parent: path.dirname(dir), entries, breadcrumb, project };
  }
  async function readFile(filePath) {
    const file = resolvePath(filePath);
    const stat = await fsp.stat(file);
    const kind = kindOf(path.basename(file), false);
    const info = { path: file, name: path.basename(file), size: stat.size, mtime: stat.mtimeMs, kind, ext: ext(file) };
    if (kind !== 'text') return info;
    if (stat.size <= 2 * 1024 * 1024) { info.content = await fsp.readFile(file, 'utf8'); return info; }
    info.tooLarge = true;
    const fh = await fsp.open(file, 'r');
    const buf = Buffer.alloc(256 * 1024);
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
    await fh.close();
    let end = bytesRead;
    while (end > 0 && (buf[end - 1] & 0xC0) === 0x80) end--;
    if (end > 0 && (buf[end - 1] & 0xC0) === 0xC0) end--;
    info.content = buf.toString('utf8', 0, end) + '\n\n… (文件较大，仅显示前 256KB)';
    return info;
  }
  async function walk(root, { onFile, onDir, limit = 4000, deadline }) {
    const queue = [root]; let count = 0, truncated = false;
    while (queue.length) {
      if (Date.now() > deadline || count >= limit) { truncated = true; break; }
      const dir = queue.shift(); let dirents;
      try { dirents = await fsp.readdir(dir, { withFileTypes: true }); } catch { continue; }
      for (const d of dirents) {
        if (d.name === '.DS_Store') continue;
        const full = path.join(dir, d.name);
        if (d.isDirectory()) {
          if (ignoreDirs.has(d.name)) continue;
          if (onDir) { let mtime = 0; try { mtime = (await fsp.lstat(full)).mtimeMs; } catch { /* */ } onDir({ name: d.name, path: full, dir, isDir: true, kind: 'dir', mtime, size: 0 }); }
          queue.push(full);
        } else {
          count++; let mtime = 0, size = 0;
          try { const stat = await fsp.lstat(full); mtime = stat.mtimeMs; size = stat.size; } catch { /* */ }
          onFile({ name: d.name, path: full, dir, isDir: false, kind: kindOf(d.name, false), mtime, size });
          if (count >= limit) { truncated = true; break; }
        }
      }
    }
    return { truncated };
  }
  function fuzzyScore(query, target) {
    const q = query.toLowerCase(), t = target.toLowerCase();
    let qi = 0, score = 0, last = -1, streak = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) if (t[ti] === q[qi]) {
      let points = 10;
      if (ti === last + 1) { streak++; points += streak * 8; } else streak = 0;
      if (ti === 0 || /[\/_\-. ]/.test(t[ti - 1])) points += 15;
      score += points + Math.max(0, 8 - ti * 0.1); last = ti; qi++;
    }
    return qi < q.length ? -1 : score - (t.length - q.length) * 0.2;
  }
  async function searchFiles(query, rootPath, deadlineTs) {
    const root = resolvePath(rootPath), q = String(query || '').trim();
    if (!q) return { results: [] };
    const matches = [];
    const scoreInto = (file, bonus) => {
      const score = fuzzyScore(q, file.name); if (score <= 0) return;
      const pathBonus = fuzzyScore(q, file.path) > 0 ? 3 : 0;
      const recency = Math.max(0, 20 - (Date.now() - file.mtime) / 86400000) * 0.6;
      matches.push({ ...file, score: score + pathBonus + recency + bonus });
    };
    const { truncated } = await walk(root, { limit: 60000, deadline: deadlineTs || Date.now() + 4000, onFile: (file) => scoreInto(file, 0), onDir: (file) => scoreInto(file, 6) });
    matches.sort((a, b) => b.score - a.score);
    return { results: matches.slice(0, 80), truncated };
  }
  async function grepFiles(query, rootPath) {
    const root = resolvePath(rootPath), q = String(query || '').trim();
    if (q.length < 2) return { results: [] };
    const lower = q.toLowerCase(), files = [];
    const { truncated: walkTrunc } = await walk(root, { limit: 12000, deadline: Date.now() + 1800, onFile: (file) => { if (file.kind === 'text' && file.size < 512 * 1024) files.push(file); } });
    files.sort((a, b) => b.mtime - a.mtime);
    const results = []; let truncated = walkTrunc; const deadline = Date.now() + 3500;
    for (const file of files) {
      if (Date.now() > deadline || results.length >= 50) { truncated = true; break; }
      let content; try { content = await fsp.readFile(file.path, 'utf8'); } catch { continue; }
      const hits = [];
      for (const [index, line] of content.split('\n').entries()) { if (hits.length >= 4) break; if (line.toLowerCase().includes(lower)) hits.push({ line: index + 1, text: line.trim().slice(0, 200) }); }
      if (hits.length) results.push({ ...file, hits });
    }
    return { results, truncated };
  }
  function mdfind(args) {
    return new Promise((resolve) => execFile('mdfind', args, { timeout: 6000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => resolve(err ? null : String(stdout).split('\n').filter(Boolean))));
  }
  async function contentSearch(query, rootPath) {
    const root = resolvePath(rootPath), q = String(query || '').trim();
    if (q.length < 2) return { results: [] };
    const escaped = q.replace(/[\\"*]/g, '');
    const paths = await mdfind(['-onlyin', root, `(kMDItemTextContent == "*${escaped}*"cd) || (kMDItemDisplayName == "*${escaped}*"cd)`]);
    if (!paths || !paths.length) return { ...await grepFiles(query, rootPath), engine: 'grep' };
    const results = [], deadline = Date.now() + 2500;
    for (const file of paths) {
      if (results.length >= 60 || Date.now() > deadline) break;
      if (/\/(node_modules|\.git|Library\/Caches)\//.test(file)) continue;
      let stat; try { stat = await fsp.stat(file); } catch { continue; }
      if (stat.isDirectory()) continue;
      const name = path.basename(file);
      results.push({ name, path: file, isDir: false, kind: kindOf(name, false), hidden: name.startsWith('.'), size: stat.size, mtime: stat.mtimeMs, btime: stat.birthtimeMs || 0 });
    }
    results.sort((a, b) => b.mtime - a.mtime);
    const lower = q.toLowerCase(); let read = 0;
    for (const result of results) {
      if (read >= 12) break;
      if (result.kind !== 'text' || result.size > 512 * 1024) continue;
      read++; let content; try { content = await fsp.readFile(result.path, 'utf8'); } catch { continue; }
      const hits = [];
      for (const [index, line] of content.split('\n').entries()) { if (hits.length >= 3) break; if (line.toLowerCase().includes(lower)) hits.push({ line: index + 1, text: line.trim().slice(0, 200) }); }
      if (hits.length) result.hits = hits;
    }
    return { results, truncated: paths.length > results.length, engine: 'spotlight' };
  }

  return { listDir, readFile, searchFiles, grepFiles, contentSearch, mdfind };
}

module.exports = { createBrowserService };
