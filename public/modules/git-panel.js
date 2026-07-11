/**
 * [INPUT]: 依赖 Git HTTP API、状态栏挂载点、文件类型推断与现有 Monaco Diff 入口
 * [OUTPUT]: 对外提供 createGitPanel，渲染仓库汇总、变更文件弹层并打开单文件改动
 * [POS]: public/modules 的只读 Git 状态控制器，被文件浏览导航和刷新流程驱动
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function createGitPanel({ $, api, escapeHtml, ic, kindFromName, showDiff, toast }) {
  let data = null;
  let loading = false;
  let opened = false;
  let requestId = 0;

  function render() {
    const slot = $('#git-status-slot');
    if (!slot) return;
    if (loading && !data) {
      slot.innerHTML = '<span class="git-summary muted">Git 检查中…</span>';
      return;
    }
    if (!data) { slot.innerHTML = ''; return; }
    if (data.available === false) {
      slot.innerHTML = '<span class="git-summary muted">本机 Git 不可用</span>';
      close();
      return;
    }
    if (!data.isRepo) {
      slot.innerHTML = '<span class="git-summary muted">当前目录不是 Git 仓库</span>';
      close();
      return;
    }
    slot.innerHTML = `<button id="git-summary" class="git-summary${data.summary.files ? ' dirty' : ''}" type="button">${ic('gitbranch', 'currentColor', 12)}<span>${escapeHtml(data.branch || 'HEAD')} · ${data.summary.files} 个文件</span> <b>+${data.summary.additions}</b> <i>−${data.summary.deletions}</i></button>`;
    $('#git-summary').onclick = (event) => { event.stopPropagation(); opened ? close() : open(); };
  }

  function fileStatus(file) {
    if (file.code === '??') return 'U';
    if (file.code.includes('R')) return 'R';
    if (file.code.includes('A')) return 'A';
    if (file.code.includes('D')) return 'D';
    return 'M';
  }

  function renderPopover() {
    const panel = $('#git-popover');
    if (!panel || !data || !data.isRepo) return;
    const files = data.files || [];
    panel.innerHTML = `
      <div class="git-pop-head">
        <div><span class="git-branch">${escapeHtml(data.branch || 'HEAD')}</span>${data.detached ? '<span class="git-detached">detached</span>' : ''}</div>
        <div class="git-total"><b>+${data.summary.additions}</b><i>−${data.summary.deletions}</i></div>
      </div>
      <div class="git-pop-list">${files.length ? files.map((file, index) => `
        <button class="git-file" data-index="${index}" type="button">
          <span class="git-code s-${fileStatus(file)}">${fileStatus(file)}</span>
          <span class="git-file-path">${escapeHtml(file.relativePath)}</span>
          <span class="git-lines">${file.binary ? 'binary' : `<b>+${file.additions}</b><i>−${file.deletions}</i>`}</span>
        </button>`).join('') : '<div class="git-clean">工作区干净</div>'}</div>`;
    panel.classList.remove('hidden');
    const anchor = $('#git-summary');
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const left = Math.max(12, Math.min(window.innerWidth - panel.offsetWidth - 12, rect.right - panel.offsetWidth));
      panel.style.left = `${left}px`;
      panel.style.top = `${Math.max(12, rect.top - panel.offsetHeight - 8)}px`;
    }
    panel.querySelectorAll('.git-file').forEach((button) => {
      button.onclick = async () => {
        const file = files[Number(button.dataset.index)];
        if (file.binary) { toast('二进制文件不支持内容比较'); return; }
        close();
        await showDiff({
          path: file.path,
          name: file.name,
          kind: kindFromName(file.name),
          deleted: file.deleted,
          size: 0,
          mtime: 0,
        });
      };
    });
  }

  function open() {
    if (!data || !data.isRepo) return;
    opened = true;
    renderPopover();
    $('#git-summary')?.classList.add('active');
  }
  function close() {
    opened = false;
    $('#git-popover')?.classList.add('hidden');
    $('#git-summary')?.classList.remove('active');
  }
  async function load(directory) {
    const id = ++requestId;
    loading = true;
    data = null;
    close();
    render();
    try {
      const result = await api('/api/git?path=' + encodeURIComponent(directory));
      if (id !== requestId) return;
      data = result;
    } catch {
      if (id !== requestId) return;
      data = { available: false, isRepo: false };
    } finally {
      if (id === requestId) { loading = false; render(); }
    }
  }

  document.addEventListener('click', (event) => {
    if (!opened || event.target.closest('#git-popover') || event.target.closest('#git-summary')) return;
    close();
  });

  return { load, render, open, close, current: () => data };
}
