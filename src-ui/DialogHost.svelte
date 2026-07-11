<!--
  [INPUT]: 依赖 Svelte 5 状态与焦点生命周期，接收输入和确认弹窗请求
  [OUTPUT]: 对外提供 inputDialog、confirmDialog Promise 接口，并串行管理全局弹窗
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

  async function advance() {
    if (active || !queue.length) return;
    active = queue.shift();
    inputValue = active.value || '';
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

  function handleKey(event) {
    if (!active || (event.key !== 'Escape' && event.key !== 'Enter')) return;
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
      {/if}
      <div class="input-actions">
        <button class="ghost-btn" type="button" onclick={cancel}>取消</button>
        <button class="primary" type="button" bind:this={confirmElement} onclick={accept}>确定</button>
      </div>
    </div>
  </div>
{/if}
