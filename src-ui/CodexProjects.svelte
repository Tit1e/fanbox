<!--
  [INPUT]: 依赖项目数据、当前目录、目录读取以及导航/拖拽/菜单回调
  [OUTPUT]: 对外提供 render/setActive 接口，声明式渲染 Codex 项目与可展开目录树
  [POS]: src-ui 的 Codex 项目列表界面岛，不承担会话归档与删除业务
  [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
-->
<script>
  import ProjectDirectory from './ProjectDirectory.svelte';

  let { listDirectories, navigate, makeDraggable, openMenu, folderIcon } = $props();
  let projects = $state([]), activePath = $state(''), now = $state(Date.now());

  export function render(list, currentPath) {
    projects = list;
    activePath = currentPath;
    now = Date.now();
  }
  export function setActive(path) { activePath = path; }

  function agoShort(ms) {
    const minutes = Math.round((now - ms) / 60000);
    if (minutes < 2) return '刚刚';
    if (minutes < 60) return `${minutes} 分`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} 时`;
    return `${Math.round(minutes / 1440)} 天`;
  }
</script>

{#if !projects.length}
  <div class="nav-empty">用 Codex 跑过的项目会出现在这里</div>
{:else}
  {#each projects as project (project.path)}
    <ProjectDirectory
      item={project}
      {activePath}
      {listDirectories}
      {navigate}
      {makeDraggable}
      {folderIcon}
      topLevel
      activeText={agoShort(project.lastActive)}
      onMenu={(event) => openMenu(event, project)}
    />
  {/each}
{/if}
