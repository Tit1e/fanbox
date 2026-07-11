/**
 * [INPUT]: 依赖 Node.js URL 与 HTTP 请求/响应对象
 * [OUTPUT]: 对外提供 hostAllowed、originAllowed、readBody 与 sendJSON
 * [POS]: server 模块的 HTTP 安全与协议基础设施，被主服务和预览服务消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

const { URL } = require('url');
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const MAX_BODY = 64 * 1024 * 1024;

function hostAllowed(req) {
  const host = (req.headers.host || '').replace(/:\d+$/, '');
  return ALLOWED_HOSTS.has(host);
}
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return ALLOWED_HOSTS.has(new URL(origin).hostname); } catch { return false; }
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '', size = 0, aborted = false;
    req.on('data', (chunk) => {
      if (aborted) return;
      size += chunk.length;
      if (size > MAX_BODY) { aborted = true; try { req.destroy(); } catch { /* */ } resolve({}); return; }
      data += chunk;
    });
    req.on('end', () => { if (!aborted) { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } } });
    req.on('error', () => { if (!aborted) { aborted = true; resolve({}); } });
  });
}
function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

module.exports = { hostAllowed, originAllowed, readBody, sendJSON };
