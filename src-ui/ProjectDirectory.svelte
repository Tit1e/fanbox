<!--
  [INPUT]: 依赖单个目录、活动路径、目录读取及导航/拖拽回调，可递归渲染自身
  [OUTPUT]: 渲染一个可展开目录行及其懒加载子目录
  [POS]: CodexProjects 的递归目录节点，只负责项目树的局部交互
  [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
-->
<script>
  import ProjectDirectory from './ProjectDirectory.svelte';

  let { item, activePath, listDirectories, navigate, makeDraggable, folderIcon, topLevel = false, activeText = '', onMenu = null } = $props();
  let expanded = $state(false), loading = $state(false), loaded = $state(false), children = $state([]);

  function drag(node) { makeDraggable(node, item.path); }
  async function toggle(event) {
    event.stopPropagation();
    if (expanded) { expanded = false; return; }
    expanded = true;
    if (loaded || loading) return;
    loading = true;
    try { children = await listDirectories(item.path); loaded = true; }
    catch { expanded = false; }
    finally { loading = false; }
  }
  function activate(event) {
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    if (event.type === 'keydown') event.preventDefault();
    navigate(item.path);
  }
  function toggleByKey(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggle(event);
  }
</script>

<li
  data-path={item.path}
  class:active={item.path === activePath}
  use:drag
  role="treeitem"
  aria-selected={item.path === activePath}
  tabindex="0"
  onclick={activate}
  onkeydown={activate}
  oncontextmenu={topLevel && onMenu ? onMenu : undefined}
>
  <span class="twirl" role="button" tabindex="0" title="展开子文件夹" onclick={toggle} onkeydown={toggleByKey}>{expanded ? '▾' : '▸'}</span>
  <span class="ico">{@html folderIcon}</span>
  <span class="label" title={topLevel ? `${item.path}\nCodex · ${activeText}前活跃` : item.path}>{item.name}</span>
  {#if topLevel}<span class="when">{activeText}</span>{/if}
</li>
{#if expanded}
  <ul class="nav-list nav-sub">
    {#if loading}<div class="nav-empty">读取中…</div>
    {:else if !children.length}<div class="nav-empty">没有子文件夹</div>
    {:else}
      {#each children as child (child.path)}
        <ProjectDirectory item={child} {activePath} {listDirectories} {navigate} {makeDraggable} {folderIcon} />
      {/each}
    {/if}
  </ul>
{/if}
