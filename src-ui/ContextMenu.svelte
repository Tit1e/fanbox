<!--
  [INPUT]: 依赖 Svelte 5 状态、鼠标坐标和带动作回调的菜单项
  [OUTPUT]: 对外提供 open/close 命令式接口，渲染视口内定位的全局右键菜单
  [POS]: src-ui 的上下文菜单宿主，替代 file-actions 中手工 DOM 创建和事件绑定
  [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
-->
<script>
  import { tick } from 'svelte';

  let items = $state([]);
  let visible = $state(false);
  let left = $state(8);
  let top = $state(8);
  let menuElement = $state(null);
  let triggerEvent = null;

  export async function open(event, nextItems) {
    event?.preventDefault?.();
    triggerEvent = event || null;
    queueMicrotask(() => {
      if (triggerEvent === event) triggerEvent = null;
    });
    items = nextItems || [];
    left = Math.max(8, event?.clientX || 0);
    top = Math.max(8, event?.clientY || 0);
    visible = true;
    await tick();
    if (!menuElement) return;
    left = Math.max(8, Math.min(left, window.innerWidth - menuElement.offsetWidth - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - menuElement.offsetHeight - 8));
  }

  export function close() {
    visible = false;
    items = [];
  }

  async function choose(item) {
    close();
    await tick();
    item.fn?.();
  }

  function outside(event) {
    // 按钮 click 打开菜单时，不能把同一次冒泡当作外部点击关闭。
    if (event === triggerEvent) return;
    if (visible && !event.target.closest('#context-menu')) close();
  }

  function handleKey(event) {
    if (!visible || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }
</script>

<svelte:document onclick={outside} />
<svelte:window onblur={close} onkeydowncapture={handleKey} />

{#if visible}
  <div id="context-menu" class="context-menu" role="menu" bind:this={menuElement} style:left="{left}px" style:top="{top}px">
    {#each items as item}
      {#if item.sep}
        <div class="ctx-sep" role="separator"></div>
      {:else}
        <button class:danger={item.danger} class="ctx-item" type="button" role="menuitem" onclick={() => choose(item)}>{item.label}</button>
      {/if}
    {/each}
  </div>
{/if}
