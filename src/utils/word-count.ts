/**
 * 字数统计工具
 *
 * 提供中英文字数统计、格式化和解析功能。
 * 使用常量定义阈值，避免魔法数字。
 */

import type { Language } from "../core/types.ts"

/** 千字阈值 */
const THOUSAND = 1_000
/** 万字阈值 */
const TEN_THOUSAND = 10_000
/** 百万字阈值 */
const MILLION = 1_000_000

/**
 * 统计中文字符数
 *
 * 支持 CJK 基本区、扩展 A 区、扩展 B 区的汉字，
 * 不统计标点符号和数字。
 *
 * @param text 要统计的文本
 * @returns 中文字符数
 *
 * @example
 * countChineseChars("你好世界") // 4
 * countChineseChars("Hello, 世界!") // 2
 */
export function countChineseChars(text: string): number {
  // \u4e00-\u9fa5      CJK 统一表意文字（基本区）
  // \u3400-\u4dbf      CJK 扩展 A 区（古汉字、生僻字）
  // \u{20000}-\u{2A6DF} CJK 扩展 B 区（需 u 标志正确处理 surrogate pair）
  const matches = text.match(/[\u4e00-\u9fa5\u3400-\u4dbf\u{20000}-\u{2A6DF}]/gu)
  return matches ? matches.length : 0
}

/**
 * 统计英文单词数
 *
 * 支持连字符和撇号组成的复合词。
 *
 * @param text 要统计的文本
 * @returns 英文单词数
 *
 * @example
 * countEnglishWords("Hello world") // 2
 * countEnglishWords("well-known story") // 2
 */
export function countEnglishWords(text: string): number {
  const matches = text.match(/[A-Za-z0-9]+(?:[''-][A-Za-z0-9]+)*/g)
  return matches ? matches.length : 0
}

/**
 * 根据语言统计文本字数
 *
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
 *
 * @param total 总字符数
 * @param lang 语言
 * @returns 如中文 "约 3 千字" 或英文 "~3K words"
 *
 * @example
 * formatWordCount(500, "zh")  // "约 500 字"
 * formatWordCount(1500, "en") // "~2K words"
 * formatWordCount(0, "zh")    // "字数待补充"
 */
export function formatWordCount(total: number, lang: Language = "zh"): string {
  if (lang === "en") {
    if (total >= THOUSAND) {
      return `~${Math.round(total / THOUSAND)}K words`
    }
    if (total > 0) {
      return `~${total} words`
    }
    return "Word count TBD"
  }
  if (total >= THOUSAND) {
    return `约 ${Math.round(total / THOUSAND)} 千字`
  }
  if (total > 0) {
    return `约 ${total} 字`
  }
  return "字数待补充"
}

/**
 * 将总字数格式化为人类可读形式
 *
 * @param total 总字符数
 * @param lang 语言
 * @returns 如中文 "约 19 万字" 或英文 "~190K words"
 *
 * @example
 * formatTotalWordCount(180000, "zh") // "约 18 万字"
 * formatTotalWordCount(5000, "en")   // "~5.0K words"
 */
export function formatTotalWordCount(total: number, lang: Language = "zh"): string {
  if (lang === "en") {
    if (total >= MILLION) {
      return `~${(total / MILLION).toFixed(1)}M words`
    }
    if (total >= THOUSAND) {
      return `~${(total / THOUSAND).toFixed(1)}K words`
    }
    return `~${total} words`
  }
  if (total >= TEN_THOUSAND) {
    return `约 ${Math.round(total / TEN_THOUSAND)} 万字`
  }
  if (total >= THOUSAND) {
    return `约 ${Math.round(total / THOUSAND)} 千字`
  }
  return `约 ${total} 字`
}

/**
 * 将格式化字数字符串解析回数字
 *
 * 支持中英文两种格式，用于统计面板的反向解析。
 * 解析失败时返回 0。
 *
 * @param formatted 格式化的字数字符串
 * @returns 解析后的数字
 *
 * @example
 * parseWordCount("~5K words")     // 5000
 * parseWordCount("~1.5M words")   // 1500000
 * parseWordCount("约 18 万字")     // 180000
 * parseWordCount("约 3 千字")      // 3000
 * parseWordCount("约 500 字")      // 500
 * parseWordCount("Word count TBD") // 0
 */
export function parseWordCount(formatted: string): number {
  if (!formatted || typeof formatted !== "string") {
    return 0
  }

  const lower = formatted.toLowerCase().trim()

  // 英文格式: ~5K words, ~1.5M words, ~500 words
  const enMatch = lower.match(/~?(\d+(?:\.\d+)?)(k|m)\s*words?/)
  if (enMatch) {
    const num = Number.parseFloat(enMatch[1])
    const unit = enMatch[2]
    if (unit === "k") return Math.round(num * THOUSAND)
    if (unit === "m") return Math.round(num * MILLION)
  }

  const enPlain = lower.match(/~(\d+)\s*words?/)
  if (enPlain) {
    return Number.parseInt(enPlain[1], 10)
  }

  // 中文格式: 约 18 万字, 约 3 千字, 约 500 字
  const zhMatch = formatted.match(/约\s*(\d+(?:\.\d+)?)\s*(万|千)?字/)
  if (zhMatch) {
    const num = Number.parseFloat(zhMatch[1])
    const unit = zhMatch[2]
    if (unit === "万") return Math.round(num * TEN_THOUSAND)
    if (unit === "千") return Math.round(num * THOUSAND)
    return Math.round(num)
  }

  return 0
}
