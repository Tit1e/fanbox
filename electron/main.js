'use strict';
/**
 * 翻箱 FanBox — Electron 主进程
 *
 * 复用零依赖后端 server.js（文件能力），叠加 node-pty 内嵌终端，
 * 让 TUI coding agent（Claude Code / Codex / Aider…）在界面里直接跑起来。
 */
const { app, BrowserWindow, ipcMain, shell, nativeImage, Menu } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

// 复用现有后端：require 即 listen 127.0.0.1:PORT，不自动开浏览器
process.env.FANBOX_NO_OPEN = '1';
const PORT = Number(process.env.FANBOX_PORT) || 4567;
require('../server.js');

// node-pty 是原生模块，需 electron-rebuild 编译过；未就绪时终端能力降级但 app 仍可用
let pty = null;
try { pty = require('node-pty'); }
catch (e) { console.error('[fanbox] node-pty 未就绪（跑 npm run rebuild）：', e.message); }

const terminals = new Map();
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 920, minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b0c0a',
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 等后端起来再加载（首次 listen 有几十毫秒延迟）
  const load = () => win.loadURL(`http://localhost:${PORT}`).catch(() => setTimeout(load, 150));
  setTimeout(load, 250);

  // 外部链接走系统浏览器，不在 app 里开新窗口
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });

  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  // 开发模式下 macOS 默认显示 Electron 图标——换成翻箱自己的（打包后由 electron-builder 的 icon 接管）
  if (process.platform === 'darwin' && app.dock) {
    try { app.dock.setIcon(nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'icon.png'))); } catch { /* */ }
  }
  app.setName('翻箱 FanBox');
  buildMenu();
  createWindow();
});

// 原生菜单——关键是 Edit role，终端里的 ⌘C/⌘V 才生效
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu', label: '翻箱 FanBox' }] : []),
    { label: '文件', submenu: [isMac ? { role: 'close' } : { role: 'quit' }] },
    { label: '编辑', submenu: [
      { role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' }, { type: 'separator' },
      { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' }, { role: 'paste', label: '粘贴' },
      { role: 'selectAll', label: '全选' },
    ] },
    { label: '视图', submenu: [
      { role: 'reload', label: '重新加载' }, { role: 'toggleDevTools', label: '开发者工具' },
      { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen', label: '全屏' },
    ] },
    { role: 'window', label: '窗口', submenu: [{ role: 'minimize', label: '最小化' }, { role: 'zoom' }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => {
  terminals.forEach((p) => { try { p.kill(); } catch { /* */ } });
  terminals.clear();
  if (process.platform !== 'darwin') app.quit();
});

// ---------- 终端 IPC（node-pty）----------
ipcMain.handle('pty:spawn', (e, { id, cwd, cols, rows }) => {
  if (!pty) return { ok: false, error: 'node-pty 未编译，跑：npm run rebuild' };
  const shellPath = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh');
  const startCwd = cwd && fs.existsSync(cwd) ? cwd : os.homedir();
  let p;
  try {
    p = pty.spawn(shellPath, [], {
      name: 'xterm-256color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: startCwd,
      env: { ...process.env, TERM: 'xterm-256color', FANBOX: '1' },
    });
  } catch (err) { return { ok: false, error: err.message }; }
  terminals.set(id, p);
  p.onData((data) => { if (win && !win.isDestroyed()) win.webContents.send('pty:data', { id, data }); });
  p.onExit(({ exitCode }) => {
    terminals.delete(id);
    if (win && !win.isDestroyed()) win.webContents.send('pty:exit', { id, exitCode });
  });
  return { ok: true, cwd: startCwd };
});
ipcMain.on('pty:input', (e, { id, data }) => { const p = terminals.get(id); if (p) p.write(data); });
ipcMain.on('pty:resize', (e, { id, cols, rows }) => { const p = terminals.get(id); if (p) { try { p.resize(cols, rows); } catch { /* */ } } });
ipcMain.on('pty:kill', (e, { id }) => { const p = terminals.get(id); if (p) { try { p.kill(); } catch { /* */ } terminals.delete(id); } });

// 取某终端 shell 的真实当前目录（用 lsof 查 pty 子进程的 cwd），实现「定位到终端目录」
ipcMain.handle('pty:cwd', (e, { id }) => new Promise((resolve) => {
  const p = terminals.get(id);
  if (!p || !p.pid) return resolve({ ok: false });
  const { exec } = require('child_process');
  exec(`lsof -a -p ${p.pid} -d cwd -Fn`, (err, stdout) => {
    if (err) return resolve({ ok: false });
    const line = stdout.split('\n').find((l) => l.startsWith('n'));
    resolve(line ? { ok: true, cwd: line.slice(1) } : { ok: false });
  });
}));

// ---------- 文件监听（agent 改文件 → 自动刷新）----------
let watcher = null;
let watchDir = null;
ipcMain.handle('fs:watch', (e, { dir }) => {
  if (dir === watchDir) return { ok: true };
  try { if (watcher) watcher.close(); } catch { /* */ }
  watcher = null; watchDir = null;
  if (!dir || !fs.existsSync(dir)) return { ok: false };
  try {
    // 递归监听：agent 在子目录改文件也能触发刷新（前端按 250ms 防抖，事件风暴只刷一次）
    watcher = fs.watch(dir, { persistent: false, recursive: true }, (evt, filename) => {
      if (win && !win.isDestroyed()) win.webContents.send('fs:changed', { dir, filename: filename ? filename.toString() : null });
    });
    watchDir = dir;
    return { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});
