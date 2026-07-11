/**
 * [INPUT]: 依赖 esbuild、esbuild-svelte 与 src-ui/ 下的 Svelte 渲染层源码
 * [OUTPUT]: 生成 public/generated/ui.mjs Svelte 离线浏览器模块
 * [POS]: build 模块的 Svelte 界面构建入口，被 npm run build:svelte 与完整检查调用
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import esbuild from 'esbuild';
import sveltePlugin from 'esbuild-svelte';

await esbuild.build({
  entryPoints: ['src-ui/index.js'],
  outfile: 'public/generated/ui.mjs',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  mainFields: ['svelte', 'browser', 'module', 'main'],
  conditions: ['svelte', 'browser'],
  plugins: [sveltePlugin({ compilerOptions: { dev: false, css: 'injected', runes: true } })],
  legalComments: 'none',
  banner: { js: `/**
 * [INPUT]: 依赖 src-ui 的 Git 面板、通用弹窗源码与打包内的 Svelte 运行时
 * [OUTPUT]: 对外提供 createGitPanel 与 createDialogService 浏览器模块
 * [POS]: public/generated 的 Svelte 界面构建产物，由 public/app.js 直接消费
 * [PROTOCOL]: 由 build/svelte-ui.mjs 生成，修改 src-ui 后重新构建并检查 AGENTS.md
 */` },
});
