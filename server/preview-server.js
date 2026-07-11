/**
 * [INPUT]: 依赖 Node.js HTTP、用户主目录、路径/Host 校验和媒体响应服务
 * [OUTPUT]: 对外提供 createPreviewServer，创建只读且屏蔽点目录的隔离预览服务
 * [POS]: server 模块的预览安全边界，与主 API 服务使用独立端口
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

const http = require('http');
const path = require('path');
const { URL } = require('url');

function createPreviewServer({ home, port, resolvePath, ext, hostAllowed, serveRaw, serveHtmlPreview }) {
  function pathAllowed(file) {
    const real = path.resolve(file), root = path.resolve(home);
    if (real !== root && !real.startsWith(root + path.sep)) return false;
    return !real.slice(root.length).split(path.sep).some((part) => part.startsWith('.'));
  }
  return http.createServer(async (req, res) => {
    if (!hostAllowed(req)) { res.writeHead(403); res.end('forbidden host'); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end('method not allowed'); return; }
    const pathname = new URL(req.url, `http://localhost:${port}`).pathname;
    if (!pathname.startsWith('/fs/')) { res.writeHead(403); res.end('preview server serves /fs/ only'); return; }
    const raw = decodeURIComponent(pathname.slice(3));
    let resolved;
    try { resolved = resolvePath(raw); } catch { res.writeHead(400); res.end('bad path'); return; }
    if (!pathAllowed(resolved)) { res.writeHead(403); res.end('outside preview scope'); return; }
    try {
      const extension = ext(raw).toLowerCase();
      if (extension === 'html' || extension === 'htm') return serveHtmlPreview(req, res, raw);
      return serveRaw(req, res, raw);
    } catch (error) { res.writeHead(500); res.end(String((error && error.message) || error)); }
  });
}

module.exports = { createPreviewServer };
