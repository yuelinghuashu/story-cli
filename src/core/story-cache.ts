/**
 * 增量构建缓存（`story build` 性能优化）
 *
 * 背景：`story build` 每次全量重建时，对每个故事都要重新读取正文 + 字数统计 +
 * 章节切分（真实小说单篇可达数十毫秒，1000+ 故事仓库累加明显）。
 *
 * 本模块用 `.story-cache.json`（Git 忽略，见 scaffold .gitignore 模板）记录每个故事
 * `StoryData` 派生物（字数 / 章节 / 展示标签）的指纹：
 *   - 指纹 = config（规范化对象序列化）+ 正文来源（text.md 的 mtime+size）+ 仓库级配置
 *   - 指纹命中 → 直接复用缓存的 StoryData，跳过正文读取与字数统计
 *   - 指纹未命中 → 重新计算并回写缓存
 *
 * 正确性边界（与 Make / tsc 的增量判定一致）：
 *   - 正文指纹用 mtime+size：正常编辑器每次写入都会更新 mtime，「同秒同大小但内容
 *     不同」的修改在常规工作流中不会发生；git checkout 也会更新 mtime
 *   - 仅缓存「正文来源为 text.md」的故事；多章节合并（chapter-*.md）的故事每次都走
 *     完整路径（保证 build 物化 text.md 的副作用不被跳过，且此类故事本就少见）
 *   - 缓存是纯优化：读取 / 写入失败一律静默降级为全量构建，不影响正确性
 */

import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import type { ChapterInfo, Language, StoryConfig, StoryData } from "./types.ts"

/** 缓存的 StoryData 派生字段（不包含正文，正文仅在未命中时读取） */
export interface CachedStoryData {
  lang: Language
  rawWordCount: number
  wordCount: string
  chapters: ChapterInfo[]
  typeDisplay: string
  statusDisplay: string
}

/** 单条缓存条目 */
export interface StoryCacheEntry {
  /** 指纹（config + 正文来源 + 仓库级配置） */
  fp: string
  data: CachedStoryData
}

/** 缓存文件结构 */
interface StoryCacheFile {
  version: number
  /** CLI 版本：升级后文案格式可能变化（如字数格式），整体失效 */
  cliVersion: string
  stories: Record<string, StoryCacheEntry>
}

/** 缓存文件名（放在仓库根目录，Git 忽略） */
export const STORY_CACHE_FILE = ".story-cache.json"

/** 缓存文件格式版本（格式变更时 +1 整体失效） */
export const STORY_CACHE_VERSION = 1

/** 空正文来源标记 */
const EMPTY_CONTENT_FP = "empty"

/** sha1 组合指纹 */
function combineFingerprint(parts: string[]): string {
  return createHash("sha1").update(parts.join("|")).digest("hex")
}

/**
 * 计算 config 指纹（规范化对象序列化）
 * 语义等价的格式变化（空白/键顺序）不影响结果，仅内容变化才失效
 */
export function configFingerprint(config: StoryConfig): string {
  return combineFingerprint([JSON.stringify(config)])
}

/**
 * 计算仓库级配置指纹（影响 typeDisplay / statusDisplay 与校验枚举）
 * 任一故事的类型/状态显示都可能随之变化，故作为所有故事指纹的公共组成部分
 */
export function repoConfigFingerprint(repoConfig: {
  types: readonly string[]
  statuses: readonly string[]
  typeLabels: Record<string, Record<string, string>>
  statusLabels: Record<string, Record<string, string>>
}): string {
  return combineFingerprint([JSON.stringify(repoConfig)])
}

/**
 * 计算正文来源指纹
 * - text.md 存在：mtime + size（stat，不读内容）
 * - 无 text.md 且无 chapter 文件：固定空标记
 * - 无 text.md 但有 chapter 文件（多章节合并来源）：返回 null —— 该故事不参与缓存
 * @param folderPath 故事文件夹路径
 * @returns 指纹；多章节合并来源时返回 null
 */
export function contentFingerprint(folderPath: string): string | null {
  const textFile = path.join(folderPath, "text.md")
  try {
    const st = fs.statSync(textFile)
    return `t:${st.mtimeMs}:${st.size}`
  } catch {
    // text.md 不存在，继续检查章节文件
  }

  let chapterNames: string[]
  try {
    chapterNames = fs.readdirSync(folderPath).filter((f) => /^chapter-.*\.md$/i.test(f))
  } catch {
    // 目录不可读（与 readStoryTextAsync 行为一致：按空正文处理）
    return EMPTY_CONTENT_FP
  }
  if (chapterNames.length > 0) return null
  return EMPTY_CONTENT_FP
}

/** 组合完整故事指纹 */
export function storyFingerprint(config: StoryConfig, contentFp: string, repoFp: string): string {
  return combineFingerprint([configFingerprint(config), contentFp, repoFp])
}

/** 读取缓存（文件缺失 / 格式版本或 CLI 版本不匹配 / 解析失败 → 空缓存） */
export function loadStoryCache(rootDir: string, cliVersion: string): Record<string, StoryCacheEntry> {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(rootDir, STORY_CACHE_FILE), "utf-8")) as StoryCacheFile
    if (raw.version !== STORY_CACHE_VERSION || raw.cliVersion !== cliVersion) return {}
    return raw.stories ?? {}
  } catch {
    return {}
  }
}

/** 写入缓存（原子写：tmp + rename；失败静默降级） */
export function saveStoryCache(rootDir: string, cliVersion: string, entries: Record<string, StoryCacheEntry>): void {
  try {
    const filePath = path.join(rootDir, STORY_CACHE_FILE)
    const content = `${JSON.stringify({ version: STORY_CACHE_VERSION, cliVersion, stories: entries }, null, 2)}\n`
    const tmpPath = `${filePath}.tmp`
    fs.writeFileSync(tmpPath, content, "utf-8")
    fs.renameSync(tmpPath, filePath)
  } catch {
    // 缓存写入失败不影响构建正确性，静默降级
  }
}

/** 从 StoryData 提取可缓存派生字段 */
export function toCachedStoryData(story: StoryData): CachedStoryData {
  return {
    lang: story.lang,
    rawWordCount: story.rawWordCount,
    wordCount: story.wordCount,
    chapters: story.chapters,
    typeDisplay: story.typeDisplay,
    statusDisplay: story.statusDisplay,
  }
}

/**
 * 从缓存重建 StoryData
 * @param folder 故事文件夹名
 * @param config 规范化配置（每次构建都会重新读取并校验，保证配置始终新鲜）
 * @param data 缓存的派生字段
 * @returns StoryData（content 为空字符串——缓存命中时不读取正文）
 */
export function buildStoryDataFromCache(folder: string, config: StoryConfig, data: CachedStoryData): StoryData {
  return {
    folder,
    config,
    content: "",
    lang: data.lang,
    wordCount: data.wordCount,
    rawWordCount: data.rawWordCount,
    chapters: data.chapters,
    typeDisplay: data.typeDisplay,
    statusDisplay: data.statusDisplay,
  }
}
