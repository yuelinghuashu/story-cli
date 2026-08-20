/**
 * 内容解析与字数统计
 * 从 scanner.ts 拆分：负责章节切分、标题提取、字数解析
 */

import { resolveLang } from "../i18n/index.ts"
import { countWords, formatWordCount } from "../utils/word-count.ts"
import type { ChapterInfo, ChapterSection, Language, StoryConfig } from "./types.ts"

/**
 * 从正文中按标题切分为章节（共享工具，供 extractChaptersLocalized / splitContentByChapters 使用）
 * 内部统一处理：按 `# 标题` / `## 标题` 切分、跳过空章节、去除标题行
 * @param content 正文内容
 * @returns 章节列表（标题 + 原始内容）
 */
export function splitSections(content: string): Array<{ title: string; rawContent: string }> {
  if (!content) return []

  const lines = content.split("\n")
  const sections: Array<{ title: string; rawContent: string }> = []
  let currentTitle: string | null = null
  let currentBuffer: string[] = []

  const flush = () => {
    if (currentTitle) {
      const rawContent = currentBuffer.join("\n").trim()
      // 跳过空章节（如正文开头的 `# 书名` 标题，后无实际内容）
      if (rawContent) {
        sections.push({ title: currentTitle, rawContent })
      }
    }
    currentBuffer = []
  }

  for (const line of lines) {
    const match = line.match(/^#{1,2}\s+(.+)$/)
    if (match) {
      flush()
      currentTitle = match[1].trim()
    } else {
      currentBuffer.push(line)
    }
  }
  flush()

  return sections
}

/**
 * 从正文中按标题切分为章节列表（共享工具，供 EPUB 导出等使用）
 * @param content 正文内容
 * @returns 章节列表（标题 + 内容）
 */
export function splitContentByChapters(content: string): ChapterSection[] {
  return splitSections(content).map((s) => ({
    title: s.title,
    content: s.rawContent,
  }))
}

/**
 * 从 text 内容中提取章节标题列表及每章字数
 * 默认使用中文统计（兼容旧接口）
 * @param content 正文内容
 * @returns 章节标题及字数列表
 */
export function extractChapters(content: string): ChapterInfo[] {
  return extractChaptersLocalized(content, "zh")
}

/**
 * 从 text 内容中提取章节标题列表及每章字数（语言感知）
 * @param content 正文内容
 * @param lang 语言（zh / en）
 * @returns 章节标题及字数列表
 */
export function extractChaptersLocalized(content: string, lang: Language = "zh"): ChapterInfo[] {
  return splitSections(content).map((s) => ({
    title: s.title,
    wordCount: formatWordCount(countWords(s.rawContent, lang), lang),
  }))
}

/**
 * 获取故事的 wordCount，优先用配置中的，否则自动计算
 * @param config 故事配置
 * @param textContent 正文内容
 * @returns 格式化的字数描述
 */
export function resolveWordCount(config: Partial<StoryConfig>, textContent: string): string {
  if (config.wordCount) return config.wordCount
  const lang = resolveLang(config)
  const words = countWords(textContent, lang)
  return formatWordCount(words, lang)
}

/**
 * 获取故事的原始字数（数字）
 * @param textContent 正文内容
 * @param lang 语言（zh / en）
 * @returns 字数（中文=字符数，英文=单词数）
 */
export function resolveRawWordCount(textContent: string, lang: Language = "zh"): number {
  return countWords(textContent, lang)
}
