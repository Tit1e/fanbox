<!--
  [INPUT]: 依赖 Svelte 5 状态、磁盘占用加载函数、路径和大小格式化能力
  [OUTPUT]: 对外提供 open/close 接口，渲染可下钻的磁盘占用透视弹层
  [POS]: src-ui 的只读磁盘分析界面岛，替代 file-actions 中命令式列表渲染
  [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
-->
<script>
  let { loadData, formatSize, parentOf, childOf, displayPath } = $props();
  let visible = $state(false);
  let path = $state('');
  let data = $state(null);
  let loading = $state(false);
  let error = $state('');
  let requestId = 0;
  let maxSize = $derived(data?.items?.length ? data.items[0].size : 1);

  export async function open(nextPath) {
    visible = true;
    await load(nextPath);
  }

  export function close() {
    visible = false;
    requestId++;
  }

  async function load(nextPath) {
    const id = ++requestId;
    path = nextPath;
    data = null;
    error = '';
    loading = true;
    try {
      const result = await loadData(nextPath);
      if (id !== requestId) return;
      if (!result.ok) error = result.error || '读取失败';
      else data = result;
    } catch {
      if (id === requestId) error = '读取失败';
    } finally {
      if (id === requestId) loading = false;
    }
  }

  function handleKey(event) {
    if (!visible || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }

  function handleOverlay(event) {
    if (event.target === event.currentTarget) close();
  }
</script>

<svelte:window onkeydowncapture={handleKey} />

{#if visible}
  <div class="input-overlay disk-overlay" role="presentation" onclick={handleOverlay}>
    <div class="input-dialog disk-dialog" role="dialog" aria-modal="true" aria-label="磁盘占用">
      <div class="input-title disk-title">磁盘占用 · {displayPath(path)}</div>
      <div class="disk-body">
        {#if loading}
          <div class="cmdk-loading">计算中…（大目录会慢几秒）</div>
        {:else if error}
          <div class="empty-state">{error}</div>
        {:else if data}
          <div class="disk-total">共 {formatSize(data.total)}{#if data.more} · 只显示前 {data.items.length} 项{/if}</div>
          {#if path !== '/'}
            <button class="disk-row disk-up" type="button" onclick={() => load(parentOf(path))}><span class="disk-name">↑ 上一级</span></button>
          {/if}
          {#each data.items as item}
            <button class:is-dir={item.isDir} class="disk-row" type="button" disabled={!item.isDir} onclick={() => item.isDir && load(childOf(path, item.name))}>
              <i class="disk-bar" style:width="{Math.max(1, Math.round(item.size / maxSize * 100))}%"></i>
              <span class="disk-name">{item.isDir ? '📁 ' : ''}{item.name}</span><span class="disk-size">{formatSize(item.size)}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}
