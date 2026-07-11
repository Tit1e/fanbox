/**
 * [INPUT]: 依赖 happy-dom 的 Window
 * [OUTPUT]: 对外提供 installDom，安装并恢复渲染层测试需要的浏览器全局对象
 * [POS]: tests/frontend 的测试环境基础设施，被所有控制器测试复用
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Window } from 'happy-dom';
import { readFile } from 'node:fs/promises';

const GLOBAL_KEYS = [
  'window', 'document', 'navigator', 'localStorage', 'location', 'Image', 'HTMLImageElement',
  'CSS', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle',
];

export function installDom(body = '') {
  const previous = new Map(GLOBAL_KEYS.map((key) => [key, globalThis[key]]));
  const window = new Window({ url: 'http://localhost:8181/' });
  window.document.body.innerHTML = body;
  const values = {
    window,
    document: window.document,
    navigator: window.navigator,
    localStorage: window.localStorage,
    location: window.location,
    Image: window.Image,
    HTMLImageElement: window.HTMLImageElement,
    CSS: window.CSS,
    ResizeObserver: window.ResizeObserver,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    getComputedStyle: window.getComputedStyle.bind(window),
  };
  Object.entries(values).forEach(([key, value]) => {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  });
  return {
    window,
    cleanup() {
      window.close();
      previous.forEach((value, key) => {
        if (value === undefined) delete globalThis[key];
        else Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
      });
    },
  };
}

export async function loadRendererModule(name) {
  const file = new URL(`../../public/modules/${name}.js`, import.meta.url);
  const source = await readFile(file, 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
