/**
 * 文件编码检测工具
 *
 * 背景：Windows 中文用户可能用记事本以 GBK/GB2312 编码保存 .md / .json 文件。
 * story-cli 所有文件 I/O 都按 UTF-8 读取，遇到 GBK 文件会输出乱码。
 *
 * 本模块使用 Node 内置 TextDecoder（zero-dependency）：
 *   1. 先用 fatal:true 严格检测是否合法 UTF-8
 *   2. 若非法，再用 gb18030（GBK 超集）尝试解码，若包含中文字符则确认为 GBK 编码
 *   3. 返回检测结果，供调用方输出警告
 */
import type { Locale } from "../i18n/index.ts"

/** 检测结果 */
export interface EncodingIssue {
  /** 文件路径（用于错误消息展示） */
  filePath: string
  /** 检测到的编码（`GBK/GB18030` 或 `unknown`） */
  encoding: string
}

/**
 * 检查字节序列是否为合法 UTF-8 编码
 * 使用 fatal:true 严格模式——任何非法字节序列都会抛错
 * @param buffer 文件原始字节
 * @returns 是否为合法 UTF-8
 */
export function isUtf8(buffer: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer)
    return true
  } catch {
    return false
  }
}

/**
 * 尝试用 GB18030 解码并判断是否可能是 GBK/GB2312 文件
 * GB18030 是 GBK 的超集，覆盖所有中文字符
 * 判断依据：解码结果中出现中文字符（纯 ASCII 文件的 GB18030 解码不会产生汉字）
 * @param buffer 文件原始字节
 * @returns 是否可能是 GBK/GB18030 编码的中文文件
 */
export function isLikelyGb18030(buffer: Uint8Array): boolean {
  try {
    const decoded = new TextDecoder("gb18030").decode(buffer)
    // 中文长文本中应出现大量汉字；纯 ASCII 的 gb18030 解码结果没有汉字
    const chineseCount = (decoded.match(/[\u4e00-\u9fa5]/g) || []).length
    return chineseCount > 0
  } catch {
    // 无法用 GB18030 解码（理论上不会发生，但防御性处理）
    return false
  }
}

/**
 * 检测文件的编码问题（核心入口）
 * @param filePath 文件路径（用于错误消息）
 * @param buffer 文件原始字节
 * @returns EncodingIssue | null（null = 合法 UTF-8 或无风险）
 */
export function detectEncodingIssue(filePath: string, buffer: Uint8Array): EncodingIssue | null {
  if (isUtf8(buffer)) return null

  // 非 UTF-8：尝试判断是否为 GBK/GB18030
  const encoding = isLikelyGb18030(buffer) ? "GBK/GB18030" : "unknown"
  return { filePath, encoding }
}

/**
 * 生成本地化警告消息
 * 供各读取模块（scanner.ts / story-loader.ts / config.ts / build.ts）调用
 * @param issue 编码检测结果
 * @param locale 当前语言文案
 * @returns 警告消息字符串
 */
export function encodingWarning(issue: EncodingIssue, locale: Locale): string {
  return issue.encoding === "GBK/GB18030"
    ? locale.encodingGbkWarning(issue.filePath)
    : locale.encodingUnknownWarning(issue.filePath)
}
