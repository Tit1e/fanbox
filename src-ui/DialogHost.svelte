<!--
  [INPUT]: 依赖 Svelte 5 状态与焦点生命周期，接收输入、确认和终端恢复请求
  [OUTPUT]: 对外提供 inputDialog、confirmDialog、recoveryDialog Promise 接口，并串行管理全局弹窗
  [POS]: src-ui 的通用弹窗宿主，替代 file-actions 中重复的命令式 DOM 生命周期
  [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
-->
<script>
  import { tick } from 'svelte';

  const queue = [];
  let active = $state(null);
  let inputValue = $state('');
  let inputElement = $state(null);
  let confirmElement = $state(null);
  let selected = $state(new Set());

  function enqueue(request) {
    return new Promise((resolve) => {
      queue.push({ ...request, resolve });
      advance();
    });
  }

  export function inputDialog(title, value = '', placeholder = '') {
    return enqueue({ kind: 'input', title, value, placeholder });
  }

  export function confirmDialog(title) {
    return enqueue({ kind: 'confirm', title });
  }

  export function recoveryDialog(entries) {
    return enqueue({ kind: 'recovery', title: '恢复上次运行的终端任务', entries });
  }

  async function advance() {
    if (active || !queue.length) return;
    active = queue.shift();
    inputValue = active.value || '';
    selected = new Set(active.kind === 'recovery' ? active.entries.filter((entry) => entry.available).map((entry) => entry.id) : []);
    await tick();
    const target = active.kind === 'input' ? inputElement : confirmElement;
    target?.focus();
    if (active.kind === 'input') target?.select();
  }

  function finish(value) {
    if (!active) return;
    const request = active;
    active = null;
    request.resolve(value);
    tick().then(advance);
  }

  function cancel() {
    finish(active?.kind === 'confirm' ? false : null);
  }

  function accept() {
    finish(active?.kind === 'confirm' ? true : inputValue.trim());
  }

  function toggle(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    selected = next;
  }

  function restore(ids) {
    finish({ action: 'restore', ids });
  }

  function handleKey(event) {
    if (!active || (event.key !== 'Escape' && event.key !== 'Enter')) return;
    if (active.kind === 'recovery' && event.key === 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') cancel();
    else accept();
  }

  function handleOverlay(event) {
    if (event.target === event.currentTarget) cancel();
  }
</script>

<svelte:window onkeydowncapture={handleKey} />

{#if active}
  <div class="input-overlay" role="presentation" onclick={handleOverlay}>
    <div class="input-dialog" role="dialog" aria-modal="true" aria-label={active.title}>
      <div class="input-title">{active.title}</div>
      {#if active.kind === 'input'}
        <input
          class="input-field"
          bind:this={inputElement}
          bind:value={inputValue}
          placeholder={active.placeholder}
          spellcheck="false"
        />
      {:else if active.kind === 'recovery'}
        <div class="recovery-hint">请选择要重新执行的命令。关闭弹窗会保留列表，下次启动仍可恢复。</div>
        <div class="recovery-list">
          {#each active.entries as entry (entry.id)}
            <label class:unavailable={!entry.available}>
              <input type="checkbox" checked={selected.has(entry.id)} disabled={!entry.available} onchange={() => toggle(entry.id)} />
              <span><code>{entry.command}</code><small>{entry.cwd}{entry.available ? '' : ' · 目录不存在'}</small></span>
            </label>
          {/each}
        </div>
      {/if}
      {#if active.kind === 'recovery'}
        <div class="input-actions recovery-actions">
          <button class="ghost-btn danger" type="button" onclick={() => finish({ action: 'clear' })}>忽略并清除</button>
          <span class="action-spacer"></span>
          <button class="ghost-btn" type="button" disabled={!selected.size} onclick={() => restore([...selected])}>恢复所选</button>
          <button class="primary" type="button" disabled={!active.entries.some((entry) => entry.available)} onclick={() => restore(active.entries.filter((entry) => entry.available).map((entry) => entry.id))}>全部恢复</button>
        </div>
      {:else}
        <div class="input-actions">
          <button class="ghost-btn" type="button" onclick={cancel}>取消</button>
          <button class="primary" type="button" bind:this={confirmElement} onclick={accept}>确定</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .recovery-hint { margin: 4px 0 12px; color: var(--text-dim); font-size: 12px; line-height: 1.5; }
  .recovery-list { max-height: 320px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; }
  .recovery-list label { display: flex; gap: 10px; padding: 11px 12px; border-bottom: 1px solid var(--border); cursor: pointer; }
  .recovery-list label:last-child { border-bottom: 0; }
  .recovery-list label:hover { background: var(--bg-3); }
  .recovery-list label.unavailable { cursor: not-allowed; opacity: .55; }
  .recovery-list input { margin-top: 3px; }
  .recovery-list span { min-width: 0; display: grid; gap: 5px; }
  .recovery-list code { overflow: hidden; color: var(--text); text-overflow: ellipsis; white-space: nowrap; }
  .recovery-list small { overflow: hidden; color: var(--text-dim); text-overflow: ellipsis; white-space: nowrap; }
  .recovery-actions { margin-top: 14px; }
  .action-spacer { flex: 1; }
  .danger { color: var(--danger, #b34f43); }
  button:disabled { cursor: not-allowed; opacity: .45; }
</style>
