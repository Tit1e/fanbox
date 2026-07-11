/**
 * [INPUT]: 依赖 Node.js git 子进程与文件读取能力、路径服务和文本扩展名集合
 * [OUTPUT]: 对外提供 createGitService，封装仓库状态与单文件 HEAD Diff
 * [POS]: server 模块的只读 Git 领域服务，被主 HTTP 路由和预览消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

const fsp = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');

function createGitService({ resolvePath, textExt, ext }) {
  function execGit(args, cwd) {
    return new Promise((resolve) => execFile('git', args, { cwd, timeout: 6000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => resolve({ ok: !err, stdout: stdout || '', stderr: stderr || '' })));
  }
  async function gitRoot(dir) {
    const result = await execGit(['-C', dir, 'rev-parse', '--show-toplevel'], dir);
    return result.ok ? result.stdout.trim() : null;
  }
  async function gitStatus(dirPath) {
    const dir = resolvePath(dirPath);
    const root = await gitRoot(dir);
    if (!root) return { isRepo: false };
    const status = await execGit(['-C', root, 'status', '--porcelain'], root);
    const files = status.stdout.split('\n').filter(Boolean).map((line) => {
      const code = line.slice(0, 2);
      let rest = line.slice(3);
      if (rest.includes(' -> ')) rest = rest.split(' -> ')[1];
      rest = rest.replace(/^"|"$/g, '');
      return { code, status: code.trim(), path: path.join(root, rest), name: path.basename(rest) };
    });
    return { isRepo: true, root, files };
  }
  async function gitFileDiff(input) {
    const file = resolvePath(input);
    if (!textExt.has(ext(file))) return { isRepo: true, diffable: false };
    const root = await gitRoot(path.dirname(file));
    if (!root) return { isRepo: false };
    const rel = path.relative(root, file).split(path.sep).join('/');
    let modified = '';
    try { modified = await fsp.readFile(file, 'utf8'); } catch { /* 新文件已被外部删除 */ }
    const head = await execGit(['-C', root, 'show', `HEAD:${rel}`], root);
    return { isRepo: true, diffable: true, root, rel, original: head.ok ? head.stdout : '', modified, isNew: !head.ok };
  }
  return { gitStatus, gitFileDiff };
}

module.exports = { createGitService };
