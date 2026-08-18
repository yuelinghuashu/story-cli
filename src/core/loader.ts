/**
 * 故事加载器
 * 从 build.ts 中抽取的共享故事加载逻辑
 * 供 build / MCP Server / 插件系统复用
 */

import fs from "node:fs"
import path from "node:path"
import { formatStatus, formatType, getLocale, resolveLang } from "../i18n/index.ts"
import { readJsonFileAsync } from "../utils/json-utils.ts"
import { getPackageVersion } from "../utils/paths.ts"
import { formatWordCount } from "../utils/word-count.ts"
import { loadRepoConfigAsync } from "./config.ts"
import {
  checkDuplicateNumbers,
  extractChaptersLocalized,
  readStoryTextAsync,
  resolveRawWordCount,
  scanStoryFoldersAsync,
} from "./scanner.ts"
import {
  buildStoryDataFromCache,
  contentFingerprint,
  loadStoryCache,
  repoConfigFingerprint,
  type StoryCacheEntry,
  saveStoryCache,
  storyFingerprint,
  toCachedStoryData,
} from "./story-cache.ts"
import type { BuildResult, StoryConfig, StoryData, StoryLoadResult, ValidationIssue } from "./types.ts"
import { type ValidationOverrides, validateConfig } from "./validate.ts"

/** 类型/状态的本地化标签映射 */
export type LabelMap = Record<string, Record<string, string>>

/**
 * 异步读取并校验单个故事的 config.json
 */
export async function loadStoryConfigAsync(
  folderPath: string,
  folder: string,
  overrides: ValidationOverrides,
): Promise<{ config: StoryConfig | null; issues: ValidationIssue[] }> {
  const configPath = path.join(folderPath, "config.json")

  let rawConfig: Record<string, unknown>
  try {
    rawConfig = await readJsonFileAsync(configPath)
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === "ENOENT") {
      return {
        config: null,
        issues: [{ code: "missing", field: "config.json", message: `${folder}: missing config.json` }],
      }
    }
    return {
      config: null,
      issues: [
        {
          code: "parse",
          field: "config.json",
          message: `${folder}: config.json read failed - ${(e as Error).message}`,
        },
      ],
    }
  }

  const result = validateConfig(rawConfig, folder, overrides)
  return { config: result.normalized, issues: result.issues }
}

/**
 * 异步读取故事正文（text.md 或合并 chapter-*.md）
 */
export async function loadStoryContentAsync(
  folderPath: string,
  validateOnly: boolean,
  locale: ReturnType<typeof getLocale>,
): Promise<{ content: string; warnings: string[] }> {
  const warnings: string[] = []
  const { content, merged } = await readStoryTextAsync(folderPath)

  if (merged) {
    warnings.push(locale.mergedWarning(path.basename(folderPath)))
    if (!validateOnly) {
      await fs.promises.writeFile(path.join(folderPath, "text.md"), content, "utf-8")
      console.error(locale.generatedText(path.basename(folderPath)))
    }
  }

  return { content, warnings }
}

/**
 * 加载全部故事
 * @param rootDir 项目根目录
 * @param saveCounts 是否将 wordCount 写回 config.json
 * @param cliLang CLI 输出语言
 * @param validateOnly 仅校验（不物化合并的 text.md、不写 README）
 * @param useCache 是否启用增量缓存（story build 非 watch 路径启用；
 *   命中时跳过正文读取与字数统计。缓存为纯优化，失败自动降级为全量构建）
 */
export async function loadStories(
  rootDir: string,
  saveCounts = false,
  cliLang = "zh",
  validateOnly = false,
  useCache = false,
): Promise<BuildResult> {
  const locale = getLocale(cliLang)
  const stories: StoryData[] = []
  const issues: ValidationIssue[] = []
  const warnings: string[] = []

  const repoConfig = await loadRepoConfigAsync(rootDir)
  const validationOverrides: ValidationOverrides = {
    types: repoConfig.types,
    statuses: repoConfig.statuses,
  }
  const typeLabels = repoConfig.typeLabels
  const statusLabels = repoConfig.statusLabels

  const folders = await scanStoryFoldersAsync(rootDir)
  // 重复序号检测复用 scanner 的共享实现（避免三处各自实现一遍）
  for (const num of checkDuplicateNumbers(rootDir)) {
    warnings.push(locale.duplicateNumberWarning(num))
  }

  // 增量缓存：指纹由 config + 正文来源 + 仓库级配置组成；仓库级配置或 CLI 版本变化时整体失效
  const cliVersion = getPackageVersion()
  const cache = useCache ? loadStoryCache(rootDir, cliVersion) : {}
  const repoFp = repoConfigFingerprint(repoConfig)
  // 新缓存从旧缓存开始，仅保留本次仍然存在的故事条目（删除/忽略的故事自动清除）；
  // 命中的条目原样保留，未命中的在加载后覆盖为最新派生数据
  const newCache: Record<string, StoryCacheEntry> = {}
  if (useCache) {
    for (const folder of folders) {
      const entry = cache[folder]
      if (entry) newCache[folder] = entry
    }
  }

  // saveCounts 模式：收集需要更新字数的配置文件路径，批量并行写入
  const pendingWrites: Array<{ folder: string; path: string; content: string }> = []

  const loadResults = await Promise.all(
    folders.map(async (folder): Promise<StoryLoadResult> => {
      const folderPath = path.join(rootDir, folder)
      const { config, issues: configIssues } = await loadStoryConfigAsync(folderPath, folder, validationOverrides)
      if (configIssues.length > 0 || config === null) {
        return { story: null, issues: configIssues, contentWarnings: [] }
      }

      // 增量缓存命中：跳过正文读取与字数统计（仅 text.md 来源的故事可缓存）
      let story: StoryData | null = null
      let contentWarnings: string[] = []
      let contentFpForCache: string | null = null
      if (useCache) {
        contentFpForCache = contentFingerprint(folderPath)
        if (contentFpForCache !== null) {
          const entry = cache[folder]
          if (entry && storyFingerprint(config, contentFpForCache, repoFp) === entry.fp) {
            story = buildStoryDataFromCache(folder, config, entry.data)
          }
        }
      }

      if (story === null) {
        // 缓存未命中（或无缓存）：完整读取正文并计算
        const loaded = await loadStoryContentAsync(folderPath, validateOnly, locale)
        contentWarnings = loaded.warnings
        story = buildStoryData(folder, config, loaded.content, typeLabels, statusLabels)
        if (useCache && contentFpForCache !== null) {
          newCache[folder] = { fp: storyFingerprint(config, contentFpForCache, repoFp), data: toCachedStoryData(story) }
        }
      }

      if (!config.wordCount) {
        console.error(locale.autoWordCount(folder, story.wordCount, saveCounts))
      }

      if (saveCounts && story.wordCount !== config.wordCount) {
        pendingWrites.push({
          folder,
          path: path.join(folderPath, "config.json"),
          content: `${JSON.stringify({ ...config, wordCount: story.wordCount }, null, 2)}\n`,
        })
      }

      return { story, issues: [], contentWarnings }
    }),
  )

  for (const result of loadResults) {
    issues.push(...result.issues)
    warnings.push(...result.contentWarnings)
    if (result.story) stories.push(result.story)
  }

  // 批量并行写入所有需要更新的 config.json（避免逐文件 await 串行 IO）
  if (pendingWrites.length > 0) {
    await Promise.all(pendingWrites.map((w) => fs.promises.writeFile(w.path, w.content, "utf-8")))
  }

  // 构建无错误时回写缓存（有错误保持旧缓存不动，避免把临时损坏状态固化）
  if (useCache && issues.length === 0) {
    saveStoryCache(rootDir, cliVersion, newCache)
  }

  return { stories, issues, warnings }
}

/**
 * 组装单个故事的 StoryData 对象（独立导出供复用）
 */
export function buildStoryData(
  folder: string,
  config: StoryConfig,
  content: string,
  typeLabels?: LabelMap,
  statusLabels?: LabelMap,
): StoryData {
  const lang = resolveLang(config)
  // 原始字数只统计一次，同时产出格式化展示字数（避免对同一文本重复扫描）
  const rawWordCount = resolveRawWordCount(content, lang)
  const wordCount = config.wordCount || formatWordCount(rawWordCount, lang)

  return {
    folder,
    config,
    content,
    lang,
    wordCount,
    rawWordCount,
    chapters: extractChaptersLocalized(content, lang),
    typeDisplay: formatType(config.type, lang, typeLabels),
    statusDisplay: formatStatus(config.status, lang, statusLabels),
  }
}
