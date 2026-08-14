/**
 * CLI 公共工具
 * 抽取多个命令中重复使用的辅助函数
 */

/**
 * 检测 CLI 输出语言：根据系统环境变量 LANG 检测，默认中文
 * @returns 语言代码（zh / en）
 */
export function detectCliLang(): string {
  const systemLang = process.env.LANG || ""
  return systemLang.toLowerCase().startsWith("en") ? "en" : "zh"
}

/**
 * 将标题转换为安全的文件名（去除/替换非法字符）
 * @param title 原始标题
 * @returns 安全文件名
 */
export function sanitizeFileName(title: string): string {
  return title
    .replace(/[\\/:*?"<>|]/g, "_") // Windows 非法字符
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) // 防止文件名过长
}
