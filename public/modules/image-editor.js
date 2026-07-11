/**
 * [INPUT]: 依赖 Canvas、共享编辑运行态、预览与文件保存回调
 * [OUTPUT]: 对外提供 createImageEditor，支持标注、打码、缩放、转格式与保存
 * [POS]: public/modules 的图片编辑领域模块，被预览动作入口消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function createImageEditor(deps) {
  const { $, state, follow, setFileFollow, guardDirty, recordRecent, mona, crepe, showPreviewPanel, applySelection, renderPreviewFoot, toast, openPreview, inputDialog, confirmDialog, apiPost, baseOf, refresh, runtime } = deps;
async function enterImageEdit(e) {
  if (follow.on) setFileFollow(false, '手动接管，文件跟随已停'); // 编辑时绝不能被跟随抢屏
  if (!await guardDirty()) return;
  recordRecent(e.path);
  mona.disposeIfAny(); crepe.disposeIfAny();
  showPreviewPanel();
  applySelection(e.path);
  $('#preview-title').textContent = '编辑 · ' + e.name;
  $('#preview-actions').innerHTML = '';
  renderPreviewFoot(null);
  const body = $('#preview-body');
  body.innerHTML = '<div class="cmdk-loading">加载图片…</div>';
  const img = new Image();
  img.onload = () => {
    // 大图 OOM 守卫：canvas 按 RGBA 估算，超 60MP（~240MB）拒绝编辑，回退预览
    if (img.naturalWidth * img.naturalHeight > 60e6) { toast('图片过大（>60MP），暂不支持编辑，请先压缩', true); openPreview(e); return; }
    buildImageEditor(e, img);
  };
  img.onerror = () => { toast('图片加载失败', true); openPreview(e); };
  img.src = '/api/raw?path=' + encodeURIComponent(e.path) + '&v=' + (e.mtime || 0);
}
function ieSnapshot(st) { const c = document.createElement('canvas'); c.width = st.canvas.width; c.height = st.canvas.height; c.getContext('2d').drawImage(st.canvas, 0, 0); return c; }
function iePos(st, ev) { const r = st.canvas.getBoundingClientRect(); return { x: (ev.clientX - r.left) * (st.canvas.width / r.width), y: (ev.clientY - r.top) * (st.canvas.height / r.height) }; }
function ieDrawShape(st, x0, y0, x1, y1) {
  const c = st.ctx; c.save();
  c.strokeStyle = st.color; c.fillStyle = st.color; c.lineWidth = st.size; c.lineCap = 'round'; c.lineJoin = 'round';
  if (st.tool === 'rect') c.strokeRect(x0, y0, x1 - x0, y1 - y0);
  else if (st.tool === 'line' || st.tool === 'arrow') {
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    if (st.tool === 'arrow') { const a = Math.atan2(y1 - y0, x1 - x0), h = Math.max(12, st.size * 3.2); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - h * Math.cos(a - 0.4), y1 - h * Math.sin(a - 0.4)); c.lineTo(x1 - h * Math.cos(a + 0.4), y1 - h * Math.sin(a + 0.4)); c.closePath(); c.fill(); }
  }
  c.restore();
}
function iePixelate(st, x0, y0, x1, y1) {
  const x = Math.max(0, Math.min(x0, x1)), y = Math.max(0, Math.min(y0, y1));
  const w = Math.min(st.canvas.width - x, Math.abs(x1 - x0)), h = Math.min(st.canvas.height - y, Math.abs(y1 - y0));
  if (w < 2 || h < 2) return;
  const block = Math.max(6, Math.round(Math.min(w, h) / 12));
  const c = st.ctx, data = c.getImageData(x, y, w, h), d = data.data;
  for (let by = 0; by < h; by += block) for (let bx = 0; bx < w; bx += block) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let yy = by; yy < Math.min(by + block, h); yy++) for (let xx = bx; xx < Math.min(bx + block, w); xx++) { const i = (yy * w + xx) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    r = r / n; g = g / n; b = b / n;
    for (let yy = by; yy < Math.min(by + block, h); yy++) for (let xx = bx; xx < Math.min(bx + block, w); xx++) { const i = (yy * w + xx) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; }
  }
  c.putImageData(data, x, y);
}
function ieToolBtn(tool, title, inner, active) {
  return `<button data-tool="${tool}" title="${title}"${active ? ' class="active"' : ''}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${inner}</svg></button>`;
}
function buildImageEditor(e, img) {
  const origExt = (e.name.split('.').pop() || 'png').toLowerCase();
  const body = $('#preview-body');
  body.innerHTML =
    `<div class="imgedit-tools">
      <div class="ie-seg" id="ie-tools">
        ${ieToolBtn('pen', '自由画笔', '<path d="M3 21c0-3 2-5 5-6 2-.7 3-2 3.5-4M21 3c-1 4-3 7-6 9"/><path d="M11 11l2 2"/>', true)}
        ${ieToolBtn('rect', '矩形框', '<rect x="4" y="6" width="16" height="12" rx="1.5"/>')}
        ${ieToolBtn('line', '直线', '<line x1="5" y1="19" x2="19" y2="5"/>')}
        ${ieToolBtn('arrow', '箭头', '<line x1="5" y1="19" x2="18" y2="6"/><polyline points="10.5 6 18 6 18 13.5"/>')}
        ${ieToolBtn('text', '文字', '<polyline points="5 7 5 5 19 5 19 7"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="9" y1="19" x2="15" y2="19"/>')}
        ${ieToolBtn('mosaic', '打码', '<rect x="4" y="4" width="6.4" height="6.4"/><rect x="13.6" y="4" width="6.4" height="6.4"/><rect x="4" y="13.6" width="6.4" height="6.4"/><rect x="13.6" y="13.6" width="6.4" height="6.4"/>')}
      </div>
      <input type="color" id="ie-color" value="#ff3b30" title="颜色">
      <span class="ie-thick" title="粗细"><input type="range" id="ie-size" min="1" max="60" value="5"><i id="ie-dot"></i></span>
      <button id="ie-undo" class="ghost-btn" title="撤销 ⌘Z">撤销</button>
    </div>
    <div class="imgedit-canvas-wrap"><canvas id="ie-canvas"></canvas></div>
    <div class="imgedit-export">
      <label>格式 <select id="ie-format"><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WEBP</option></select></label>
      <label>宽度 <input id="ie-width" type="number" min="16" step="1"></label>
      <label id="ie-quality-wrap" style="display:none">质量 <input id="ie-quality" type="range" min="10" max="100" value="85"></label>
      <span class="ie-spacer"></span>
      <button id="ie-saveas" class="ghost-btn">另存为</button>
      <button id="ie-save" class="primary">保存</button>
    </div>`;
  const canvas = $('#ie-canvas');
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  $('#ie-width').value = img.naturalWidth;
  // 粗细随图分辨率自适应：大图默认更粗，才「看得出」；滑块上限也按图放大
  const defSize = Math.max(3, Math.round(img.naturalWidth / 250));
  const maxSize = Math.max(40, Math.round(img.naturalWidth / 30));
  const st = { e, img, canvas, ctx, tool: 'pen', color: '#ff3b30', size: defSize, undo: [], base: null, dragging: false, sx: 0, sy: 0, lastX: 0, lastY: 0, origExt, dirty: false };
  runtime.imgEditState = st;
  // 未保存守卫：图片一旦落过笔（dirty）就拦住离开，避免 Esc/✕ 静默清空画布
  runtime.dirtyCheck = () => !!runtime.imgEditState && runtime.imgEditState.dirty;
  const sizeInput = $('#ie-size'); sizeInput.max = String(maxSize); sizeInput.value = String(defSize);
  const fmtSel = $('#ie-format');
  fmtSel.value = ['jpg', 'jpeg'].includes(origExt) ? 'jpeg' : (origExt === 'webp' ? 'webp' : 'png');
  const toggleQ = () => { $('#ie-quality-wrap').style.display = fmtSel.value === 'png' ? 'none' : ''; };
  toggleQ();
  bindImageEditor(st, toggleQ);
}
function bindImageEditor(st, toggleQ) {
  $('#ie-tools').querySelectorAll('button').forEach((b) => { b.onclick = () => { st.tool = b.dataset.tool; $('#ie-tools').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b)); }; });
  // 粗细可视化：滑块旁的小圆点直观显示当前笔触粗细
  const updateDot = () => { const d = $('#ie-dot'); if (d) { const px = Math.min(22, Math.max(3, st.size)); d.style.width = px + 'px'; d.style.height = px + 'px'; d.style.background = st.color; d.title = st.size + 'px'; } };
  updateDot();
  $('#ie-color').oninput = (ev) => { st.color = ev.target.value; updateDot(); };
  $('#ie-size').oninput = (ev) => { st.size = Number(ev.target.value); updateDot(); };
  $('#ie-format').onchange = toggleQ;
  $('#ie-undo').onclick = () => ieUndo(st);
  const canvas = st.canvas;
  canvas.addEventListener('pointerdown', async (ev) => {
    const { x, y } = iePos(st, ev);
    if (st.tool === 'text') {
      const txt = await inputDialog('添加文字', '', '输入文字');
      if (!txt) return;
      st.undo.push(ieSnapshot(st)); if (st.undo.length > 25) st.undo.shift();
      const c = st.ctx; c.save(); c.fillStyle = st.color; c.textBaseline = 'top';
      c.font = `600 ${Math.max(14, st.size * 6)}px ${getComputedStyle(document.documentElement).getPropertyValue('--font-ui')}`;
      c.fillText(txt, x, y); c.restore();
      st.dirty = true;
      return;
    }
    st.base = ieSnapshot(st); st.dragging = true; st.sx = x; st.sy = y; st.lastX = x; st.lastY = y;
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!st.dragging) return;
    const { x, y } = iePos(st, ev);
    if (st.tool === 'pen') {
      // 自由画笔：逐段累加，画任意形状（不还原 base）
      const c = st.ctx; c.save(); c.strokeStyle = st.color; c.lineWidth = st.size; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(st.lastX, st.lastY); c.lineTo(x, y); c.stroke(); c.restore();
      st.lastX = x; st.lastY = y; return;
    }
    st.ctx.drawImage(st.base, 0, 0); // 还原到拖拽前，再画预览
    if (st.tool === 'mosaic') { st.ctx.save(); st.ctx.strokeStyle = st.color; st.ctx.setLineDash([6, 4]); st.ctx.lineWidth = 2; st.ctx.strokeRect(st.sx, st.sy, x - st.sx, y - st.sy); st.ctx.restore(); }
    else ieDrawShape(st, st.sx, st.sy, x, y);
  });
  canvas.addEventListener('pointerup', (ev) => {
    if (!st.dragging) return;
    st.dragging = false;
    const { x, y } = iePos(st, ev);
    if (st.tool !== 'pen') {
      st.ctx.drawImage(st.base, 0, 0);
      if (st.tool === 'mosaic') iePixelate(st, st.sx, st.sy, x, y);
      else ieDrawShape(st, st.sx, st.sy, x, y);
    }
    st.undo.push(st.base); if (st.undo.length > 25) st.undo.shift();
    st.dirty = true;
  });
  $('#ie-save').onclick = () => ieSave(st, false);
  $('#ie-saveas').onclick = () => ieSave(st, true);
}
function ieUndo(st) { const snap = st.undo.pop(); if (!snap) { toast('没有可撤销的'); return; } st.ctx.drawImage(snap, 0, 0); }
function ieExport(st) {
  const fmt = $('#ie-format').value;
  const w = Math.max(16, parseInt($('#ie-width').value, 10) || st.canvas.width);
  let out = st.canvas;
  if (w !== st.canvas.width) { const h = Math.round(st.canvas.height * (w / st.canvas.width)); out = document.createElement('canvas'); out.width = w; out.height = h; out.getContext('2d').drawImage(st.canvas, 0, 0, w, h); }
  const q = (parseInt($('#ie-quality').value, 10) || 85) / 100;
  const mime = fmt === 'jpeg' ? 'image/jpeg' : (fmt === 'webp' ? 'image/webp' : 'image/png');
  return { dataUrl: out.toDataURL(mime, q), ext: fmt === 'jpeg' ? 'jpg' : fmt };
}
async function ieSave(st, asNew) {
  const { dataUrl, ext } = ieExport(st);
  const sameType = st.origExt === ext || (['jpg', 'jpeg'].includes(st.origExt) && ext === 'jpg');
  let newName = null;
  if (asNew || !sameType) {
    const suggest = st.e.name.replace(/\.[^.]+$/, '') + (asNew ? '-编辑' : '') + '.' + ext;
    newName = await inputDialog(asNew ? '另存为' : '格式已变，另存为新文件', suggest, '文件名（含扩展名）');
    if (!newName) return;
  } else {
    // 覆盖原图不可逆且为有损重编码——给一次确认（删除都走废纸篓，覆盖更该拦）
    const ok = await confirmDialog('将覆盖原图、且重新编码（可能轻微降质），此操作不可恢复。确定覆盖？建议用「另存为」。');
    if (!ok) return;
  }
  const r = await apiPost('/api/image-save', { path: st.e.path, dataUrl, newName });
  if (r.error) { toast('保存失败：' + r.error, true); return; }
  toast(newName ? '已另存为 ' + baseOf(r.path) : '已保存（已覆盖原图）');
  runtime.imgEditState = null;
  await refresh();
  const saved = state.entries.find((x) => x.path === r.path) || st.e;
  applySelection(saved.path); openPreview(saved);
}

// ---------- 操作 ----------

  return { enterImageEdit, undoImage: () => { if (runtime.imgEditState) ieUndo(runtime.imgEditState); } };
}
