/**
 * 统一的调试日志通道。
 *
 * 隐私约定：插件在**默认状态下不向控制台输出任何用户数据**
 * （查词内容、生词本词条、选中文本、词典返回值等一律不打印）。
 * 所有调试用的 console.log 都必须走这里的 debugLog / debugWarn。
 *
 * 需要排查问题时，两种开启方式（二者取其一）：
 *   1. 把下面的 DEBUG_LOGS 改为 true，重新构建；
 *   2. 保持构建不变，在 Obsidian 控制台执行（临时生效，重载插件后失效）：
 *        globalThis.__FLEURDICT_DEBUG__ = true
 *
 * 注意：**真正的错误日志**（console.error / console.warn）不走本通道，
 * 它们只在出错时触发、且不应携带用户内容，保留以保证可排查性。
 */

/** 调试日志总开关（源码级，默认 false） */
export const DEBUG_LOGS = false;

/** 是否输出调试日志：源码开关 或 运行时开关 */
function isDebugEnabled(): boolean {
  if (DEBUG_LOGS) return true;
  try {
    return (globalThis as { __FLEURDICT_DEBUG__?: boolean }).__FLEURDICT_DEBUG__ === true;
  } catch {
    return false;
  }
}

/** 调试日志（仅在调试开关打开时输出） */
export function debugLog(...args: unknown[]): void {
  if (isDebugEnabled()) console.log(...args);
}

/** 调试告警（仅在调试开关打开时输出） */
export function debugWarn(...args: unknown[]): void {
  if (isDebugEnabled()) console.warn(...args);
}
