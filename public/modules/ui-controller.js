/**
 * [INPUT]: 依赖共享 state、终端/命令面板控制器及文件和预览动作
 * [OUTPUT]: 对外提供 createUiController，管理全局事件、主题、拖拽尺寸和首次引导
 * [POS]: public/modules 的界面编排控制器，被应用启动入口消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function createUiController(deps) {
  const { $, state, term, cmdk, toast, goBack, goUp, renderFiles, openPreview, closePreview, toggleSidebar, applyPreviewSize, setFileFollow, follow, doCreate, doTrash, doRename, diskPanel, organizeLaunch, closeContextMenu, popupMenu, mona, svgWrap, SVG, openWith, playChime, shotTray, dropFilesInto, dropUrlInto, runtime, undoImage, isPreviewMax, setPreviewMax, moveCursor, cursorEnter, toggleFav } = deps;
// ---------- 首次引导 ----------
function maybeShowGuide() {
  if (localStorage.getItem('codexbox_guided')) return;
  const ov = document.createElement('div');
  ov.className = 'guide-overlay';
  ov.innerHTML = `<div class="guide-card">
    <div class="guide-logo">${svgWrap(SVG.box, 'currentColor', 46, true)}</div>
    <h2>欢迎用 CodexBox</h2>
    <p>Codex 的驾驶舱——找文件、跑 Codex、看它改、随手改，都在一个窗口：</p>
    <ul>
      <li><b>⌘K</b> 全局搜文件和文件夹；<b>⌘↵</b> 把项目直接在编辑器整包打开；<code>内容:关键词</code> 搜文件里的字</li>
      <li>顶部 <b>终端</b> 按钮开内嵌终端跑 Codex；<b>把文件/文件夹拖进终端</b> 即插入路径喂给它当上下文</li>
      <li><b>单击</b> 预览，<b>双击</b> 系统打开；预览里 <b>编辑</b> md 走所见即所得、<b>编辑图片</b> 可标注/打码/转格式</li>
      <li>Codex 改了哪些文件，列表实时高亮「改·N」，不用切窗口盯着看</li>
    </ul>
    <button id="guide-ok">开始使用</button>
  </div>`;
  document.body.appendChild(ov);
  $('#guide-ok').onclick = () => { localStorage.setItem('codexbox_guided', '1'); ov.remove(); };
}

// ---------- 预览面板拖拽调宽 ----------
function bindResizer() {
  const handle = $('#preview-resizer');
  let dragging = false;
  handle.addEventListener('mousedown', (e) => { dragging = true; e.preventDefault(); handle.classList.add('dragging'); document.body.style.userSelect = 'none'; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const fm = $('#filemgmt').getBoundingClientRect();
    if (term.dock === 'right') { // 预览在文件区下方 → 纵向拖
      state.previewH = Math.round(Math.min(fm.height - 120, Math.max(140, fm.bottom - e.clientY)));
    } else { // 预览在文件区右侧 → 横向拖
      state.previewW = Math.round(Math.min(fm.width - 220, Math.max(260, fm.right - e.clientX)));
    }
    applyPreviewSize();
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false; handle.classList.remove('dragging'); document.body.style.userSelect = '';
    localStorage.setItem('codexbox_preview_w', state.previewW);
    localStorage.setItem('codexbox_preview_h', state.previewH || 340);
  });
}

// 终端面板拖拽调整大小（底部拖高度 / 右侧拖宽度）
// 丝滑要点：mousemove 只记目标值，用 rAF 每帧最多应用一次（含一次 fit），不再每个事件都 fit 触发重排
function bindTerminalResizer() {
  const handle = $('#terminal-resizer');
  let dragging = false, raf = null, target = null, squeeze = false;
  const SNAP = 48; // 拖到离边缘 48px 内 → 吸附成全铺（fm-squeezed），不再留丑陋的残条
  const fitNow = () => { const s = term.sessions.find((x) => x.id === term.active); if (s && s.fit) { try { s.fit.fit(); } catch { /* */ } } };
  const apply = () => {
    raf = null;
    if (target == null) return;
    const panel = $('#terminal-panel');
    $('#main-body').classList.toggle('fm-squeezed', squeeze);
    if (term.dock === 'bottom') panel.style.height = target + 'px';
    else panel.style.width = target + 'px';
    target = null;
    fitNow();
  };
  handle.addEventListener('mousedown', (e) => {
    dragging = true; e.preventDefault();
    // 铺满态下抓分割条 = 想拖回分屏，直接退出铺满（不走 toggleMax，拖拽中不要过渡动画）
    if (term.maximized) {
      term.maximized = false;
      $('#main-body').classList.remove('term-max');
      const b = $('#term-max'); if (b) { b.classList.remove('on'); b.title = '终端铺满'; }
    }
    squeeze = $('#main-body').classList.contains('fm-squeezed');
    handle.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = term.dock === 'bottom' ? 'row-resize' : 'col-resize';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rect = $('#main-body').getBoundingClientRect();
    if (term.dock === 'bottom') {
      const raw = rect.bottom - e.clientY;
      squeeze = raw >= rect.height - SNAP;
      target = Math.round(Math.min(rect.height - 4, Math.max(60, raw)));
    } else {
      const raw = rect.right - e.clientX;
      squeeze = raw >= rect.width - SNAP;
      target = Math.round(Math.min(rect.width - 4, Math.max(140, raw)));
    }
    if (!raf) raf = requestAnimationFrame(apply);
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false; handle.classList.remove('dragging');
    document.body.style.userSelect = ''; document.body.style.cursor = '';
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    apply(); fitNow();
    const panel = $('#terminal-panel');
    localStorage.setItem('codexbox_term_squeeze', squeeze ? '1' : '0');
    if (term.dock === 'bottom') localStorage.setItem('codexbox_term_h', parseInt(panel.style.height, 10) || 280);
    else localStorage.setItem('codexbox_term_w', parseInt(panel.style.width, 10) || 480);
  });
}

// ---------- Codex 快速启动与终端设置 ----------
function codexResumeLast() {
  try { return localStorage.getItem('codexbox_codex_resume_last') !== '0'; } catch { return true; }
}
function syncCodexLaunchHint() {
  const btn = $('#term-codex');
  if (btn) btn.title = codexResumeLast()
    ? '在左侧当前目录新建终端标签并继续最近的 Codex 会话'
    : '在左侧当前目录新建终端标签并启动新的 Codex 会话';
}
const terminalSettingsPop = {
  el: null,
  toggle() { if (this.el) this.close(); else this.open(); },
  close() {
    if (!this.el) return;
    this.el.remove();
    this.el = null;
    document.removeEventListener('mousedown', this._out, true);
  },
  open() {
    const pop = document.createElement('div');
    pop.className = 'terminal-settings-pop';
    pop.innerHTML = `<div class="tsp-head">终端设置</div>
      <label class="tsp-row" title="一键启动时继续左侧当前目录最近的 Codex 会话">
        <input type="checkbox" data-setting="resume-last" ${codexResumeLast() ? 'checked' : ''}>
        <span>继续最近 Codex 会话</span>
      </label>
      <label class="tsp-row" title="Codex 等待确认或任务完成时播放提示音">
        <input type="checkbox" data-setting="chime" ${state.muted ? '' : 'checked'}>
        <span>Codex 提示音</span>
      </label>
      <label class="tsp-row" title="长时间中文输出偶发乱码时可关掉：改用兼容渲染（DOM），立即生效，稍慢但稳">
        <input type="checkbox" data-setting="webgl" ${(() => { try { return localStorage.getItem('codexbox.noWebgl') === '1' ? '' : 'checked'; } catch { return 'checked'; } })()}>
        <span>WebGL 加速渲染</span>
      </label>`;
    document.body.appendChild(pop);
    const anchor = $('#term-settings');
    const r = anchor.getBoundingClientRect();
    pop.style.top = Math.round(r.bottom + 6) + 'px';
    pop.style.right = Math.max(8, Math.round(window.innerWidth - r.right - 8)) + 'px';
    this.el = pop;
    pop.querySelector('[data-setting="resume-last"]').onchange = (ev) => {
      localStorage.setItem('codexbox_codex_resume_last', ev.target.checked ? '1' : '0');
      syncCodexLaunchHint();
      toast(ev.target.checked ? '一键启动将继续最近 Codex 会话' : '一键启动将创建新的 Codex 会话');
    };
    pop.querySelector('[data-setting="chime"]').onchange = (ev) => {
      state.muted = !ev.target.checked;
      localStorage.setItem('codexbox_muted', state.muted ? '1' : '0');
      if (!state.muted) playChime('tick');
      toast(state.muted ? 'Codex 提示音已关闭' : 'Codex 提示音已开启');
    };
    pop.querySelector('[data-setting="webgl"]').onchange = (ev) => {
      term.setWebgl(ev.target.checked);
      toast(ev.target.checked ? 'WebGL 渲染已开启' : '已切换兼容渲染（修中文乱码）');
    };
    this._out = (ev) => { if (!pop.contains(ev.target) && !anchor.contains(ev.target)) this.close(); };
    document.addEventListener('mousedown', this._out, true);
  },
};

function bindCodexControls() {
  syncCodexLaunchHint();
  $('#term-codex').onclick = () => term.launchCodex();
  $('#term-settings').onclick = () => terminalSettingsPop.toggle();
}

// ---------- 事件绑定 ----------
function bindEvents() {
  // 顶栏窄时分级藏低频控件（观测自身宽度而非视口——侧栏会吃掉一截且可折叠）
  const tb = $('#topbar');
  new ResizeObserver((es) => {
    const w = es[0].contentRect.width;
    tb.classList.toggle('tb-sm', w < 980);
    tb.classList.toggle('tb-xs', w < 880);
    tb.classList.toggle('tb-xxs', w < 790);
    tb.classList.toggle('tb-min', w < 660);
  }).observe(tb);
  // 文件区被终端/预览压窄时，列表列让位：名称优先，先藏「大小」再藏「修改时间」（#49）
  const fa = $('#file-area');
  new ResizeObserver((es) => {
    const w = es[0].contentRect.width;
    fa.classList.toggle('fa-narrow', w < 620);
    fa.classList.toggle('fa-tight', w < 460);
  }).observe(fa);
  // ←/↑ 顶栏按钮已删（与面包屑功能重复、且和 macOS 红绿灯冲突）；后退/上一级保留 ⌘[ 和 Backspace 快捷键
  $('#preview-close').onclick = closePreview;
  $('#cmdk-trigger').onclick = () => cmdk.open();
  $('#btn-terminal').onclick = () => term.toggle();
  bindCodexControls();
  shotTray.init();
  $('#term-newtab').onclick = () => term.newTab();
  $('#term-max').onclick = () => term.toggleMax();
  const termTabs = $('#term-tabs');
  termTabs.addEventListener('wheel', (ev) => {
    if (!ev.deltaY || termTabs.scrollWidth <= termTabs.clientWidth) return;
    ev.preventDefault();
    termTabs.scrollLeft += ev.deltaY;
  }, { passive: false });
  // 双击终端顶栏空白处（避开标签/按钮/输入框）= 铺满终端：agent 交互窗口最重要，给它一键放到最大
  $('.term-head').addEventListener('dblclick', (ev) => {
    if (ev.target.closest('button, .term-tab, input')) return;
    term.toggleMax();
  });
  $('#term-dock').onclick = () => term.setDock(term.dock === 'bottom' ? 'right' : 'bottom');
  $('#term-close').onclick = () => term.close();
  $('#btn-sidebar').onclick = () => toggleSidebar();
  $('#file-follow').onclick = () => setFileFollow(!follow.on);
  // 定位文件按钮已撤（双击终端 tab 即可定位，见 term.locateCwd / renderTabs 的 ondblclick）
  // 终端随窗口尺寸变化重排，避免 TUI 错位
  window.addEventListener('resize', () => term.fitActive());
  if (window.ResizeObserver) new ResizeObserver(() => term.fitActive()).observe($('#xterm-host'));
  bindTerminalResizer();
  // 拖拽文件/文件夹到终端 → 插入路径
  const tp = $('#terminal-panel');
  tp.addEventListener('dragover', (ev) => {
    const t = ev.dataTransfer.types;
    if (!t.includes('Files') && !t.includes('application/x-codexbox-path') && !t.includes('text/plain')) return;
    ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; tp.classList.add('term-drop');
  });
  tp.addEventListener('dragleave', (ev) => { if (!tp.contains(ev.relatedTarget)) tp.classList.remove('term-drop'); });
  tp.addEventListener('drop', async (ev) => {
    ev.preventDefault(); tp.classList.remove('term-drop');
    // 系统拖入（Finder 文件 / 截图浮窗缩略图）：有真实路径直接用；file-promise 没路径就落盘临时目录
    const files = ev.dataTransfer.files ? [...ev.dataTransfer.files] : [];
    if (files.length && window.codexboxDrop) {
      for (const f of files) {
        let p = window.codexboxDrop.pathForFile(f);
        if (!p) {
          const r = await window.codexboxDrop.saveTemp(f.name, await f.arrayBuffer()).catch(() => null);
          if (r && r.ok) p = r.path;
        }
        if (p) term.insertPath(p);
      }
      return;
    }
    const p = ev.dataTransfer.getData('application/x-codexbox-path') || ev.dataTransfer.getData('text/plain');
    if (p) term.insertPath(p);
  });
  // 全局兜底：文件拖到窗口其它区域松手时，阻止 Electron 导航到 file:// 顶掉整个界面
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
  // 文件区空白处双击/右键 → 新建菜单（#7：右键空白是更普遍的肌肉记忆）
  const blankMenu = (e) => {
    if (e.target.closest('.item') || e.target.closest('.row')) return; // 条目自身的菜单不抢
    e.preventDefault();
    popupMenu(e, [
      { label: '新建文件夹…', fn: () => doCreate('dir') },
      { label: '新建文件…', fn: () => doCreate('file') },
      { sep: true },
      { label: '在 Finder 显示', fn: () => openWith(state.cwd, 'reveal') },
      { label: '在终端打开', fn: () => term.openInDir(state.cwd) },
      { label: 'AI 整理…', fn: () => organizeLaunch(state.cwd) },
      { label: '磁盘占用透视', fn: () => diskPanel(state.cwd) },
    ]);
  };
  $('#file-area').addEventListener('dblclick', blankMenu);
  $('#file-area').addEventListener('contextmenu', blankMenu);
  // 拖入文件区 = 存进当前目录；拖到某文件夹图标上 = 存进那个文件夹（截图浮窗、Finder 文件都行）。
  // 接两类：①「外部文件」拖入（dataTransfer 里有 Files）；② app 内/外部图片拖入（带 text/uri-list 的 <img>，如预览里的图）。
  // codexbox 内部路径拖拽（带 application/x-codexbox-path，拖去终端用）排除在外，不受影响。
  const fileArea = $('#file-area');
  const droppableTypes = (t) => t.includes('Files') || (t.includes('text/uri-list') && !t.includes('application/x-codexbox-path'));
  const clearDropHi = () => { fileArea.classList.remove('area-drop'); fileArea.querySelectorAll('.item.drop-into').forEach((x) => x.classList.remove('drop-into')); };
  fileArea.addEventListener('dragover', (ev) => {
    if (!droppableTypes(ev.dataTransfer.types)) return;
    ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy';
    const item = ev.target.closest('.item');
    const idx = item ? Number(item.dataset.idx) : -1;
    const overDir = idx >= 0 && state.visible[idx] && state.visible[idx].isDir ? item : null;
    if (overDir) { if (!overDir.classList.contains('drop-into')) { clearDropHi(); overDir.classList.add('drop-into'); } }
    else { fileArea.querySelectorAll('.item.drop-into').forEach((x) => x.classList.remove('drop-into')); fileArea.classList.add('area-drop'); }
  });
  fileArea.addEventListener('dragleave', (ev) => { if (!fileArea.contains(ev.relatedTarget)) clearDropHi(); });
  fileArea.addEventListener('drop', async (ev) => {
    const dt = ev.dataTransfer;
    const hasFiles = dt.files && dt.files.length;
    const url = (!hasFiles && dt.types.includes('text/uri-list') && !dt.types.includes('application/x-codexbox-path')) ? dt.getData('text/uri-list') : '';
    if (!hasFiles && !url) return;
    ev.preventDefault(); clearDropHi();
    const item = ev.target.closest('.item');
    const idx = item ? Number(item.dataset.idx) : -1;
    const over = idx >= 0 ? state.visible[idx] : null;
    const dir = over && over.isDir ? over.path : state.cwd;
    if (hasFiles) await dropFilesInto(dt.files, dir);
    else await dropUrlInto(url, dir);
  });
  $('#content').addEventListener('contextmenu', (e) => { if (!e.target.closest('#file-area')) blankMenu(e); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#context-menu')) closeContextMenu(); });
  window.addEventListener('blur', closeContextMenu);
  $('#scope-toggle').onclick = () => cmdk.toggleScope();

  $('#toggle-hidden').checked = state.showHidden;
  $('#toggle-hidden').onchange = (e) => { state.showHidden = e.target.checked; localStorage.setItem('codexbox_hidden', state.showHidden ? '1' : '0'); renderFiles(); };

  $('#sort-seg').querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.sort === state.sort);
    b.onclick = () => { state.sort = b.dataset.sort; localStorage.setItem('codexbox_sort', state.sort); $('#sort-seg').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b)); renderFiles(); };
  });
  $('#view-seg').querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === state.view);
    b.onclick = () => { state.view = b.dataset.view; localStorage.setItem('codexbox_view', state.view); $('#view-seg').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b)); updateGridSizeVisibility(); renderFiles(); };
  });
  $('#gridsize-seg').querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === state.gridSize);
    b.onclick = () => { state.gridSize = b.dataset.size; localStorage.setItem('codexbox_gridsize', state.gridSize); $('#gridsize-seg').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b)); renderFiles(); };
  });
  updateGridSizeVisibility();

  $('#cmdk-input').oninput = (e) => cmdk.search(e.target.value);
  $('#cmdk').onclick = (e) => { if (e.target.id === 'cmdk') cmdk.close(); };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#context-menu')) { closeContextMenu(); return; }
    const cmdkOpen = !$('#cmdk').classList.contains('hidden');
    const lbOpen = !!document.querySelector('.lightbox');
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); cmdkOpen ? cmdk.close() : cmdk.open(); return; }
    if (cmdkOpen) {
      if (e.key === 'Escape') cmdk.close();
      else if (e.key === 'ArrowDown') { e.preventDefault(); cmdk.move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cmdk.move(-1); }
      else if (e.key === 'Tab') { e.preventDefault(); cmdk.toggleScope(); }
      else if (e.key === 'Enter') { e.preventDefault(); cmdk.choose(cmdk.active, e.metaKey || e.ctrlKey); }
      return;
    }
    if (lbOpen) { if (e.key === 'Escape') document.querySelector('.lightbox').remove(); return; }
    const primaryShortcut = window.codexboxEnv?.platform === 'darwin' ? e.metaKey : (e.ctrlKey || e.metaKey);
    const terminalTabShortcut = primaryShortcut && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key);
    if (terminalTabShortcut && !document.querySelector('.input-overlay')) {
      e.preventDefault();
      term.activateByShortcut(Number(e.key));
      return;
    }
    if (runtime.imgEditState && (e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undoImage(); return; }
    // 全屏预览下 Esc 先退出全屏（即便焦点在 md 编辑器里），不直接关掉预览
    if (e.key === 'Escape' && isPreviewMax()) { e.preventDefault(); setPreviewMax(false); return; }
    const inTerm = document.activeElement?.closest('.xterm');
    const inInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable || inTerm;
    // 输入框里按 Esc 先退出输入，别越级把预览关掉
    if (e.key === 'Escape' && inInput) { document.activeElement.blur(); return; }
    if (e.key === 'Escape' && !$('#preview').classList.contains('hidden')) { closePreview(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === '[') { e.preventDefault(); goBack(); return; }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B') && !inInput) { e.preventDefault(); toggleSidebar(); return; }
    if (inInput) return;
    // 主区键盘导航
    if (e.key === 'ArrowDown') { e.preventDefault(); moveCursor(state.cols); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveCursor(-state.cols); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); moveCursor(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); moveCursor(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); cursorEnter(e.metaKey || e.ctrlKey); }
    else if ((e.metaKey || e.ctrlKey) && (e.key === 'Backspace' || e.key === 'Delete')) { e.preventDefault(); const it = state.visible[state.cursor]; if (it) doTrash(it); }
    else if (e.key === 'Backspace') { e.preventDefault(); goUp(); }
    else if (e.key === ' ') { e.preventDefault(); const it = state.visible[state.cursor]; if (it) toggleFav(it); }
    else if (e.key === 'F2') { e.preventDefault(); const it = state.visible[state.cursor]; if (it) doRename(it); }
  });
}
function updateGridSizeVisibility() {
  $('#gridsize-seg').style.display = state.view === 'grid' ? '' : 'none';
}

// ---------- 主题 / 皮肤 ----------
function applyTheme(skin, rerender = true) {
  if (!['terminal', 'warm', 'editorial'].includes(skin)) skin = 'terminal';
  state.theme = skin;
  document.documentElement.dataset.theme = skin;
  localStorage.setItem('codexbox_theme', skin);
  const link = document.getElementById('hljs-theme');
  if (link) link.href = '/vendor/hljs/styles/' + (skin === 'terminal' ? 'github-dark' : 'github') + '.min.css';
  document.querySelectorAll('#theme-switch .theme-seg button').forEach((b) => b.classList.toggle('active', b.dataset.skin === skin));
  if (typeof term !== 'undefined' && term.sessions.length) term.retheme();
  if (typeof mona !== 'undefined') mona.retheme();
  if (rerender && state.entries.length) {
    renderFiles();
    // 预览里的代码高亮配色随皮肤切换，重渲染当前选中项
    if (state.selected && !$('#preview').classList.contains('hidden')) {
      const e = state.entries.find((x) => x.path === state.selected);
      if (e) openPreview(e);
    }
  }
}

  return { maybeShowGuide, bindResizer, bindTerminalResizer, codexResumeLast, bindCodexControls, bindEvents, updateGridSizeVisibility, applyTheme };
}
