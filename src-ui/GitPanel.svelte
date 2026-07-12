<!--
  [INPUT]: 依赖 Svelte 5 响应式状态、Git 状态数据、Git 图标与文件选择回调
  [OUTPUT]: 对外提供常驻分支名、按需变更汇总、body portal 弹层和 update/open/close 边界
  [POS]: src-ui 的首个渐进式界面岛，负责 Git 状态汇总和变更文件弹层渲染
  [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
-->
<script>
  import { tick } from 'svelte';

  let { icon = '', onFile = () => {} } = $props();
  let data = $state(null);
  let loading = $state(false);
  let opened = $state(false);
  let summaryElement = $state(null);
  let popoverElement = $state(null);

  export function update(view) {
    data = view.data;
    loading = view.loading;
    if (!data?.isRepo) opened = false;
  }

  export async function open() {
    if (!data?.isRepo) return;
    opened = true;
    await tick();
    positionPopover();
  }

  export function close() {
    opened = false;
  }

  function toggle(event) {
    event.stopPropagation();
    if (opened) close();
    else open();
  }

  function outside(event) {
    if (!opened || event.target.closest('#git-popover') || event.target.closest('#git-summary')) return;
    close();
  }

  function positionPopover() {
    if (!summaryElement || !popoverElement) return;
    const rect = summaryElement.getBoundingClientRect();
    const left = Math.max(12, Math.min(window.innerWidth - popoverElement.offsetWidth - 12, rect.right - popoverElement.offsetWidth));
    popoverElement.style.left = `${left}px`;
    popoverElement.style.top = `${Math.max(12, rect.top - popoverElement.offsetHeight - 8)}px`;
  }

  function fileStatus(file) {
    if (file.code === '??') return 'U';
    if (file.code.includes('R')) return 'R';
    if (file.code.includes('A')) return 'A';
    if (file.code.includes('D')) return 'D';
    return 'M';
  }

  function portal(node) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
</script>

<svelte:document onclick={outside} />

{#if loading && !data}
  <span class="git-summary muted">Git 检查中…</span>
{:else if data?.available === false}
  <span class="git-summary muted">本机 Git 不可用</span>
{:else if data && !data.isRepo}
  <span class="git-summary muted">当前目录不是 Git 仓库</span>
{:else if data?.isRepo}
  <button
    id="git-summary"
    class:dirty={data.summary.files > 0}
    class:active={opened}
    class="git-summary"
    type="button"
    bind:this={summaryElement}
    onclick={toggle}
  >
    {@html icon}
    <span class="git-branch-name">{data.branch || 'HEAD'}</span>
    {#if data.summary.files > 0}
      <span class="git-file-count">· {data.summary.files} 个文件</span>
      <b>+{data.summary.additions}</b>
      <i>−{data.summary.deletions}</i>
    {/if}
  </button>

  <div
    id="git-popover"
    class:hidden={!opened}
    class="git-popover"
    bind:this={popoverElement}
    use:portal
  >
    <div class="git-pop-head">
      <div><span class="git-branch">{data.branch || 'HEAD'}</span>{#if data.detached}<span class="git-detached">detached</span>{/if}</div>
      {#if data.summary.files > 0}<div class="git-total"><b>+{data.summary.additions}</b><i>−{data.summary.deletions}</i></div>{/if}
    </div>
    <div class="git-pop-list">
      {#each data.files || [] as file}
        <button class="git-file" type="button" onclick={() => onFile(file)}>
          <span class="git-code s-{fileStatus(file)}">{fileStatus(file)}</span>
          <span class="git-file-path">{file.relativePath}</span>
          <span class="git-lines">
            {#if file.binary}binary{:else}<b>+{file.additions}</b><i>−{file.deletions}</i>{/if}
          </span>
        </button>
      {:else}
        <div class="git-clean">工作区干净</div>
      {/each}
    </div>
  </div>
{/if}
