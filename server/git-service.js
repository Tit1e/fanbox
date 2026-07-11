/**
 * [INPUT]: 依赖 Node.js git 子进程与文件读取能力、路径服务和文本扩展名集合
 * [OUTPUT]: 对外提供 createGitService，封装仓库分支、文件状态、增删行汇总与单文件 HEAD Diff
 * [POS]: server 模块的只读 Git 领域服务，被主 HTTP 路由和预览消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');

function createGitService({ resolvePath, kindOf }) {
  function execGit(args, cwd) {
    return new Promise((resolve) => execFile('git', args, { cwd, timeout: 6000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => resolve({
      ok: !err, stdout: stdout || '', stderr: stderr || '', errorCode: err && err.code,
    })));
  }
  async function repository(dir) {
    const result = await execGit(['-C', dir, 'rev-parse', '--show-toplevel'], dir);
    if (result.errorCode === 'ENOENT') return { available: false, root: null };
    return { available: true, root: result.ok ? result.stdout.trim() : null };
  }
  function parseStatus(output) {
    const parts = output.split('\0');
    const files = [];
    for (let index = 0; index < parts.length; index++) {
      const item = parts[index];
      if (!item) continue;
      const code = item.slice(0, 2);
      const relativePath = item.slice(3);
      files.push({ code, relativePath });
      if (/[RC]/.test(code)) index++; // -z 格式的重命名/复制后面还有原路径
    }
    return files;
  }
  function parseNumstat(output) {
    const stats = new Map();
    const parts = output.split('\0');
    for (let index = 0; index < parts.length; index++) {
      const item = parts[index];
      if (!item) continue;
      const first = item.indexOf('\t');
      const second = item.indexOf('\t', first + 1);
      if (first < 0 || second < 0) continue;
      const added = item.slice(0, first);
      const deleted = item.slice(first + 1, second);
      const stat = {
        additions: added === '-' ? null : Number(added),
        deletions: deleted === '-' ? null : Number(deleted),
        binary: added === '-' || deleted === '-',
      };
      const relativePath = item.slice(second + 1);
      if (relativePath) stats.set(relativePath, stat);
      else {
        index++; // 重命名的原路径
        const destination = parts[++index];
        if (destination) stats.set(destination, stat);
      }
    }
    return stats;
  }
  function countFileLines(file) {
    return new Promise((resolve) => {
      let lines = 0, bytes = 0, last = 10;
      const stream = fs.createReadStream(file);
      stream.on('data', (chunk) => {
        bytes += chunk.length;
        last = chunk[chunk.length - 1];
        for (const byte of chunk) if (byte === 10) lines++;
      });
      stream.on('error', () => resolve(0));
      stream.on('end', () => resolve(lines + (bytes > 0 && last !== 10 ? 1 : 0)));
    });
  }
  async function gitStatus(dirPath) {
    const dir = resolvePath(dirPath);
    const repo = await repository(dir);
    if (!repo.available) return { available: false, isRepo: false };
    if (!repo.root) return { available: true, isRepo: false };
    const root = repo.root;
    const [statusResult, branchResult, headResult] = await Promise.all([
      execGit(['-C', root, 'status', '--porcelain=v1', '-z', '--untracked-files=all'], root),
      execGit(['-C', root, 'symbolic-ref', '--quiet', '--short', 'HEAD'], root),
      execGit(['-C', root, 'rev-parse', '--verify', 'HEAD'], root),
    ]);
    const diffArgs = headResult.ok
      ? ['-C', root, 'diff', '--numstat', '-z', 'HEAD', '--']
      : ['-C', root, 'diff', '--numstat', '-z', '--cached', '--'];
    const stats = parseNumstat((await execGit(diffArgs, root)).stdout);
    const records = parseStatus(statusResult.stdout);
    const files = await Promise.all(records.map(async ({ code, relativePath }) => {
      const file = path.join(root, relativePath);
      let stat = stats.get(relativePath);
      if (!stat && code === '??') {
        const binary = kindOf(path.basename(relativePath), false) !== 'text';
        stat = { additions: binary ? null : await countFileLines(file), deletions: binary ? null : 0, binary };
      }
      stat ||= { additions: 0, deletions: 0, binary: false };
      return {
        code,
        status: code.trim() || code,
        path: file,
        relativePath,
        name: path.basename(relativePath),
        additions: stat.additions,
        deletions: stat.deletions,
        binary: stat.binary,
        deleted: code.includes('D'),
      };
    }));
    const detached = !branchResult.ok;
    const branch = detached ? headResult.stdout.trim().slice(0, 7) : branchResult.stdout.trim();
    const summary = files.reduce((total, file) => {
      total.additions += file.additions || 0;
      total.deletions += file.deletions || 0;
      if (file.binary) total.binary++;
      return total;
    }, { files: files.length, additions: 0, deletions: 0, binary: 0 });
    return { available: true, isRepo: true, root, branch, detached, summary, files };
  }
  async function gitFileDiff(input) {
    const file = resolvePath(input);
    const parent = await fsp.realpath(path.dirname(file)).catch(() => path.dirname(file));
    const canonicalFile = path.join(parent, path.basename(file));
    const repo = await repository(parent);
    if (!repo.available) return { available: false, isRepo: false };
    const root = repo.root;
    if (!root) return { available: true, isRepo: false };
    if (kindOf(path.basename(file), false) !== 'text') return { available: true, isRepo: true, diffable: false };
    const rel = path.relative(root, canonicalFile).split(path.sep).join('/');
    let modified = '';
    try { modified = await fsp.readFile(canonicalFile, 'utf8'); } catch { /* 新文件已被外部删除 */ }
    const head = await execGit(['-C', root, 'show', `HEAD:${rel}`], root);
    return { available: true, isRepo: true, diffable: true, root, rel, original: head.ok ? head.stdout : '', modified, isNew: !head.ok };
  }
  return { gitStatus, gitFileDiff };
}

module.exports = { createGitService };
