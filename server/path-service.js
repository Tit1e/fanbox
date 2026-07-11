/**
 * [INPUT]: 依赖 Node.js path，依赖调用方提供的用户主目录
 * [OUTPUT]: 对外提供 createPathService、文件类型常量与 MIME 映射
 * [POS]: server 模块的路径与文件类型真源，被文件、搜索、媒体和 HTTP 服务共同消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

const path = require('path');

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', '.cache', '.venv', 'venv',
  '__pycache__', '.DS_Store', 'Pods', '.gradle', 'target', '.idea', '.vscode-test',
  'DerivedData', '.expo', '.turbo', 'vendor', '.svn', '.hg',
]);
const TEXT_EXT = new Set([
  'txt', 'md', 'markdown', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json', 'json5',
  'html', 'htm', 'css', 'scss', 'less', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift',
  'c', 'h', 'cpp', 'hpp', 'cc', 'm', 'mm', 'sh', 'bash', 'zsh', 'fish', 'sql', 'yml',
  'yaml', 'toml', 'ini', 'env', 'conf', 'xml', 'svg', 'vue', 'astro', 'php', 'lua',
  'r', 'dart', 'gradle', 'properties', 'gitignore', 'dockerfile', 'makefile', 'log',
  'csv', 'tsv', 'gql', 'graphql', 'prisma', 'plist', 'tex', 'rtf', 'srt', 'vtt', 'ass',
]);
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'heic', 'heif', 'tiff', 'tif']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac']);
const PDF_EXT = new Set(['pdf']);
const ARCHIVE_EXT = new Set(['zip', 'jar', 'tar', 'tgz', 'gz', 'bz2', 'xz', '7z', 'rar']);
const MIME = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  js: 'application/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8', svg: 'image/svg+xml',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon', avif: 'image/avif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/mp4',
  ogv: 'video/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  m4a: 'audio/mp4', flac: 'audio/flac', aac: 'audio/aac', pdf: 'application/pdf',
  ttf: 'font/ttf', woff: 'font/woff', woff2: 'font/woff2',
};

function ext(name) {
  const i = name.lastIndexOf('.');
  return i <= 0 ? '' : name.slice(i + 1).toLowerCase();
}
function projectOf(names) {
  if (names.has('package.json')) return 'node';
  if (names.has('index.html')) return 'web';
  if (names.has('requirements.txt') || names.has('pyproject.toml')) return 'python';
  if (names.has('Cargo.toml')) return 'rust';
  if (names.has('go.mod')) return 'go';
  if (names.has('.git')) return 'git';
  return null;
}
function kindOf(name, isDir) {
  if (isDir) return 'dir';
  const e = ext(name);
  if (IMAGE_EXT.has(e)) return 'image';
  if (VIDEO_EXT.has(e)) return 'video';
  if (AUDIO_EXT.has(e)) return 'audio';
  if (PDF_EXT.has(e)) return 'pdf';
  if (ARCHIVE_EXT.has(e)) return 'archive';
  if (TEXT_EXT.has(e) || /^(dockerfile|makefile|readme|license|\.[a-z]+rc)$/i.test(name)) return 'text';
  return 'other';
}
function createPathService(home) {
  function resolvePath(input) {
    if (!input || typeof input !== 'string') return home;
    if (input.includes('\0')) throw new Error('非法路径');
    let abs = input.startsWith('~') ? path.join(home, input.slice(1)) : input;
    if (!path.isAbsolute(abs)) abs = path.join(home, abs);
    return path.normalize(abs);
  }
  return { resolvePath };
}

module.exports = {
  IGNORE_DIRS, TEXT_EXT, IMAGE_EXT, VIDEO_EXT, AUDIO_EXT, PDF_EXT, ARCHIVE_EXT, MIME,
  ext, projectOf, kindOf, createPathService,
};
