import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import { resolveLang } from "../utils/i18n.ts"
import { countWords, formatWordCount } from "../utils/word-count.ts"
import type { ChapterInfo, ChapterSection, Language, StoryConfig } from "./types.ts"

/** 需要排除的非故事目录（仅保留通用基础设施目录） */
export const EXCLUDE_DIRS = new Set([".git", "node_modules", "dist", "assets"])

/** 故事文件夹命名模式：NN-名称（至少两位数字，保证字典序排序稳定） */
const STORY_FOLDER_PATTERN = /^\d{2,}-.+/

/** 赞助图片约定目录（相对于项目根目录） */
const SPONSOR_DIR = "assets/sponsor"

/** 支持的赞助图片扩展名 */
const IMAGE_EXT_PATTERN = /\.(png|jpe?g|gif|webp|bmp)$/i

/**
 * 获取赞助图片列表（约定目录 assets/sponsor/ 中的图片）
 * @param rootDir 项目根目录
 * @returns 图片相对路径列表（如 ["assets/sponsor/ali-pay.jpg"]）
 */
export function getSponsorImages(rootDir: string): string[] {
  const sponsorPath = path.join(rootDir, SPONSOR_DIR)

  if (!fs.existsSync(sponsorPath)) return []

  try {
    return fs
      .readdirSync(sponsorPath)
      .filter((f) => IMAGE_EXT_PATTERN.test(f))
      .map((f) => path.join(SPONSOR_DIR, f))
      .sort()
  } catch {
    return []
  }
}

/**
 * 扫描根目录下的故事文件夹
 * @param rootDir 项目根目录
 * @returns 排序后的故事文件夹名称列表
 */
export function scanStoryFolders(rootDir: string): string[] {
  return fs
    .readdirSync(rootDir)
    .filter((item) => {
      const fullPath = path.join(rootDir, item)
      if (!fs.statSync(fullPath).isDirectory()) return false
      if (EXCLUDE_DIRS.has(item)) return false
      return STORY_FOLDER_PATTERN.test(item)
    })
    .sort()
}

/**
 * 检查是否存在序号重复的故事文件夹
 * @param rootDir 项目根目录
 * @returns 重复的序号列表（去重后的序号字符串）
 */
export function checkDuplicateNumbers(rootDir: string): string[] {
  const folders = scanStoryFolders(rootDir)
  const seen = new Map<string, string>()
  const duplicates = new Set<string>()

  for (const folder of folders) {
    const num = folder.split("-")[0]
    const existing = seen.get(num)
    if (existing !== undefined) {
      duplicates.add(num)
    } else {
      seen.set(num, folder)
    }
  }

  return [...duplicates].sort()
}

/**
 * 异步扫描根目录下的故事文件夹
 * 与 scanStoryFolders 行为一致，但使用 fs/promises 避免阻塞事件循环
 * @param rootDir 项目根目录
 * @returns 排序后的故事文件夹名称列表
 */
export async function scanStoryFoldersAsync(rootDir: string): Promise<string[]> {
  let items: string[]
  try {
    items = await fsp.readdir(rootDir)
  } catch {
    return []
  }

  const folders: string[] = []
  for (const item of items) {
    // 先排除约定目录（无需 stat）
    if (EXCLUDE_DIRS.has(item)) continue
    if (!STORY_FOLDER_PATTERN.test(item)) continue

    try {
      const stat = await fsp.stat(path.join(rootDir, item))
      if (stat.isDirectory()) folders.push(item)
    } catch {
      // 忽略 stat 失败（竞态删除等）
    }
  }

  return folders.sort()
}

/**
 * 异步读取故事正文（text.md 或合并 chapter-*.md）
 * 与 readStoryText 行为一致，但使用 fs/promises 避免阻塞事件循环
 * @param folderPath 故事文件夹路径
 * @returns 正文内容和是否合并生成
 */
export async function readStoryTextAsync(folderPath: string): Promise<{ content: string; merged: boolean }> {
  const textFile = path.join(folderPath, "text.md")

  // 已有 text.md 直接读取
  try {
    const content = await fsp.readFile(textFile, "utf-8")
    return { content, merged: false }
  } catch {
    // text.md 不存在，继续尝试合并
  }

  // 合并 chapter-*.md
  let chapterFiles: string[]
  try {
    chapterFiles = (await fsp.readdir(folderPath)).filter((f) => /^chapter-.*\.md$/i.test(f)).sort()
  } catch {
    return { content: "", merged: false }
  }

  if (chapterFiles.length === 0) {
    return { content: "", merged: false }
  }

  const sections: string[] = []
  for (const file of chapterFiles) {
    const raw = (await fsp.readFile(path.join(folderPath, file), "utf-8")).trim()
    // 跳过 已存在但内容为空 的情况
    if (!raw) continue
    // 提取章节标题（第一个 # 标题），若不存在则用文件名
    const titleMatch = raw.match(/^#\s+(.+)$/m)
    const title = titleMatch ? titleMatch[1] : file.replace(/\.md$/, "")
    sections.push(`# ${title}\n\n${raw.replace(/^#\s+.+$/m, "").trim()}`)
  }

  return { content: sections.join("\n\n---\n\n"), merged: true }
}

/**
 * 合并故事文件夹中的章节文件为单一 text 内容
 * 优先使用已有 text.md；不存在时合并 chapter-*.md
 * @param folderPath 故事文件夹路径
 * @returns 正文内容和是否合并生成
 */
export function readStoryText(folderPath: string): { content: string; merged: boolean } {
  const textFile = path.join(folderPath, "text.md")

  // 已有 text.md 直接读取
  if (fs.existsSync(textFile)) {
    return { content: fs.readFileSync(textFile, "utf-8"), merged: false }
  }

  // 合并 chapter-*.md
  const chapterFiles = fs
    .readdirSync(folderPath)
    .filter((f) => /^chapter-.*\.md$/i.test(f))
    .sort()

  if (chapterFiles.length === 0) {
    return { content: "", merged: false }
  }

  const sections: string[] = []
  for (const file of chapterFiles) {
    const raw = fs.readFileSync(path.join(folderPath, file), "utf-8").trim()
    // 跳过 已存在但内容为空 的情况
    if (!raw) continue
    // 提取章节标题（第一个 # 标题），若不存在则用文件名
    const titleMatch = raw.match(/^#\s+(.+)$/m)
    const title = titleMatch ? titleMatch[1] : file.replace(/\.md$/, "")
    sections.push(`# ${title}\n\n${raw.replace(/^#\s+.+$/m, "").trim()}`)
  }

  return { content: sections.join("\n\n---\n\n"), merged: true }
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
  if (!content) return []

  const lines = content.split("\n")
  const chapters: ChapterInfo[] = []
  let currentTitle: string | null = null
  let currentBuffer: string[] = []

  const flush = () => {
    if (currentTitle) {
      const words = countWords(currentBuffer.join("\n"), lang)
      chapters.push({
        title: currentTitle,
        wordCount: formatWordCount(words, lang),
      })
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

  return chapters
}

/**
 * 从正文中按标题切分为章节列表（共享工具，供 EPUB 导出等使用）
 * @param content 正文内容
 * @returns 章节列表（标题 + 内容）
 */
export function splitContentByChapters(content: string): ChapterSection[] {
  if (!content) return []

  const lines = content.split("\n")
  const sections: ChapterSection[] = []
  let currentTitle: string | null = null
  let currentBuffer: string[] = []

  const flush = () => {
    if (currentTitle) {
      sections.push({ title: currentTitle, content: currentBuffer.join("\n").trim() })
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
