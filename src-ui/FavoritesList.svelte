<!--
  [INPUT]: 依赖收藏数据、当前目录、目录读取以及导航/预览/移除/拖拽回调
  [OUTPUT]: 对外提供 render/setActive 接口，渲染目录与文件收藏
  [POS]: src-ui 的收藏列表界面岛，目录节点复用 ProjectDirectory
  [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
-->
<script>
  import ProjectDirectory from './ProjectDirectory.svelte';

  let { listDirectories, navigate, openFile, remove, makeDraggable, folderIcon, fileIcon } = $props();
  let favorites = $state([]), activePath = $state('');

  export function render(list, currentPath) { favorites = list; activePath = currentPath; }
  export function setActive(path) { activePath = path; }
  function drag(node, path) { makeDraggable(node, path); }
  function activateFile(event, favorite) {
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    if (event.type === 'keydown') event.preventDefault();
    openFile(favorite);
  }
  function removeByKey(event, favorite) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault(); event.stopPropagation(); remove(favorite);
  }
</script>

{#if !favorites.length}
  <div class="nav-empty">悬停文件点 ☆ 即可收藏</div>
{:else}
  {#each favorites as favorite (favorite.path)}
    {#if favorite.isDir}
      <ProjectDirectory item={favorite} {activePath} {listDirectories} {navigate} {makeDraggable} {folderIcon} onRemove={remove} />
    {:else}
      <li data-path={favorite.path} role="treeitem" aria-selected="false" tabindex="0" use:drag={favorite.path} onclick={(event) => activateFile(event, favorite)} onkeydown={(event) => activateFile(event, favorite)}>
        <span class="ico">{@html fileIcon}</span>
        <span class="label" title={favorite.path}>{favorite.name}</span>
        <span class="unfav" role="button" tabindex="0" title="移除" onclick={(event) => { event.stopPropagation(); remove(favorite); }} onkeydown={(event) => removeByKey(event, favorite)}>✕</span>
      </li>
    {/if}
  {/each}
{/if}
