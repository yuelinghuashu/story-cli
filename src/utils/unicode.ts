/**
 * Unicode 安全截断工具
 * 修复 JS 原生 String.prototype.slice 在 surrogate pair（emoji/扩展B区生僻字）边界处
 * 会切断字符导致孤立代理（显示为 `�`）的问题
 *
 * 使用 Array.from() 按 Unicode 码点迭代，再 slice/join，保证不切断 surrogate pair
 * 注意：组合 emoji（ZWJ 序列如 👨👩👧）仍可能被切开——完整处理需 Intl.Segmenter，
 * 与项目极简依赖哲学冲突，本次仅保证"不产生孤立代理/乱码"
 */

/**
 * 按 Unicode 码点安全截断字符串（前 N 个码点）
 * @param text 原始文本
 * @param maxCodePoints 最大码点数（字符数）
 * @returns 截断后的字符串，末尾不会有畸形 surrogate
 */
export function safeTruncate(text: string, maxCodePoints: number): string {
  if (Array.from(text).length <= maxCodePoints) return text
  return Array.from(text).slice(0, maxCodePoints).join("")
}

/**
 * 按 Unicode 码点安全截取末尾 N 个码点（MCP tailLength 用）
 * @param text 原始文本
 * @param count 截取码点数
 * @returns 末尾截取的字符串
 */
export function safeTail(text: string, count: number): string {
  if (count <= 0) return ""
  const chars = Array.from(text)
  return chars.slice(Math.max(0, chars.length - count)).join("")
}
