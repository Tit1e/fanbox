/**
 * [INPUT]: 依赖 Electron app/dialog、PTY 真实运行任务统计、窗口获取与双语文案函数
 * [OUTPUT]: 对外提供 createQuitGuard，管理异步退出检查、确认和重复请求去重
 * [POS]: electron 模块的应用退出安全边界，被 main.js 的窗口关闭与 before-quit 生命周期消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

function createQuitGuard({ app, dialog, ptyService, getWindow = () => null, translate = (zh) => zh }) {
  let quitting = false;
  let checking = false;

  const quit = () => {
    quitting = true;
    app.quit();
  };

  function handleBeforeQuit(event) {
    if (quitting) return;
    if (ptyService.count() === 0) { quitting = true; return; }
    event.preventDefault();
    if (checking) return;
    checking = true;

    ptyService.countRunningTasks().then(async (runningTasks) => {
      if (runningTasks === 0) { quit(); return; }
      try {
        const win = getWindow();
        const { response } = await dialog.showMessageBox(win && !win.isDestroyed() ? win : undefined, {
          type: 'warning',
          buttons: [translate('取消', 'Cancel'), translate('退出', 'Quit')],
          defaultId: 0,
          cancelId: 0,
          message: translate(`还有 ${runningTasks} 个终端任务正在运行`, `${runningTasks} terminal task(s) still running`),
          detail: translate('退出会终止正在运行的任务，确定退出？', 'Quitting will terminate running tasks. Quit anyway?'),
        });
        if (response === 1) quit();
      } catch { /* 确认框失败时留在应用内，不能静默终止已确认运行的任务。 */ }
    }).catch(() => {
      // 无法确认有任务运行时不阻止退出，符合“只保护确实运行的任务”的规则。
      quit();
    }).finally(() => { checking = false; });
  }

  return {
    handleBeforeQuit,
    isQuitting: () => quitting,
    isChecking: () => checking,
  };
}

module.exports = { createQuitGuard };
