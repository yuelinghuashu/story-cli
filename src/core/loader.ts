/**
 * 故事加载器
 * 从 build.ts 中抽取的共享故事加载逻辑
 * 供 build / MCP Server / 插件系统复用
 */

import fs from "node:fs"
import path from "node:path"
import { formatStatus, formatType, getLocale, resolveLang } from "../i18n/index.ts"
import { readJsonFileAsync } from "../utils/json-utils.ts"
import { loadRepoConfigAsync } from "./config.ts"
import {
  extractChaptersLocalized,
  readStoryTextAsync,
  resolveRawWordCount,
  resolveWordCount,
  scanStoryFoldersAsync,
} from "./scanner.ts"
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
 * 组装单个故事的 StoryData 对象
 */
export async function loadStories(
  rootDir: string,
  saveCounts = false,
  cliLang = "zh",
  validateOnly = false,
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
  const numberSeen = new Map<string, string>()
  const duplicates = new Set<string>()
  for (const folder of folders) {
    const num = folder.split("-")[0]
    const existing = numberSeen.get(num)
    if (existing !== undefined) {
      duplicates.add(num)
    } else {
      numberSeen.set(num, folder)
    }
  }
  for (const num of [...duplicates].sort()) {
    warnings.push(locale.duplicateNumberWarning(num))
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
      const { content, warnings: contentWarnings } = await loadStoryContentAsync(folderPath, validateOnly, locale)
      const story = buildStoryData(folder, config, content, typeLabels, statusLabels)

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
  const wordCount = resolveWordCount(config, content)

  return {
    folder,
    config,
    content,
    lang,
    wordCount,
    rawWordCount: resolveRawWordCount(content, lang),
    chapters: extractChaptersLocalized(content, lang),
    typeDisplay: formatType(config.type, lang, typeLabels),
    statusDisplay: formatStatus(config.status, lang, statusLabels),
  }
}
