import type { Language } from "../core/types.ts"

/**
 * 统计中文字符数
 * @param text 要统计的文本
 * @returns 中文字符数
 */
export function countChineseChars(text: string): number {
  // 直接提取所有汉字字符（\u4e00-\u9fa5 覆盖 CJK 统一表意文字）
  // 无需维护标点黑名单：所有非汉字字符（标点、空白、数字、字母）自然被忽略
  const matches = text.match(/[\u4e00-\u9fa5]/g)
  return matches ? matches.length : 0
}

/**
 * 统计英文单词数
 * @param text 要统计的文本
 * @returns 英文单词数
 */
export function countEnglishWords(text: string): number {
  // 匹配英文单词（含连字符、撇号）
  const matches = text.match(/[A-Za-z0-9]+(?:[''-][A-Za-z0-9]+)*/g)
  return matches ? matches.length : 0
}

/**
 * 根据语言统计文本字数
 * @param text 要统计的文本
 * @param lang 语言（zh / en）
 * @returns 字数
 */
export function countWords(text: string, lang: Language = "zh"): number {
  if (lang === "en") return countEnglishWords(text)
  return countChineseChars(text)
}

/**
 * 将字数格式化为人类可读形式
 * @param total 总字符数
 * @param lang 语言
 * @returns 如中文 "约 6 千字" 或英文 "~6K words"
 */
export function formatWordCount(total: number, lang: Language = "zh"): string {
  if (lang === "en") {
    if (total >= 1000) {
      return `~${Math.round(total / 1000)}K words`
    } else if (total > 0) {
      return `~${total} words`
    }
    return "Word count TBD"
  }
  if (total >= 1000) {
    return `约 ${Math.round(total / 1000)} 千字`
  } else if (total > 0) {
    return `约 ${total} 字`
  }
  return "字数待补充"
}

/**
 * 将总字数格式化为人类可读形式
 * @param total 总字符数
 * @param lang 语言
 * @returns 如中文 "约 19 万字" 或英文 "~190K words"
 */
export function formatTotalWordCount(total: number, lang: Language = "zh"): string {
  if (lang === "en") {
    if (total >= 1000000) {
      return `~${(total / 1000000).toFixed(1)}M words`
    } else if (total >= 1000) {
      return `~${(total / 1000).toFixed(1)}K words`
    }
    return `~${total} words`
  }
  if (total >= 10000) {
    return `约 ${Math.round(total / 10000)} 万字`
  } else if (total >= 1000) {
    return `约 ${Math.round(total / 1000)} 千字`
  }
  return `约 ${total} 字`
}
