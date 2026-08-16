/**
 * 故事加载器
 * 从 build.ts 中抽取的共享故事加载逻辑
 * 供 build / MCP Server / 插件系统复用
 */

import fs from "node:fs"
import path from "node:path"
import { formatStatus, formatType, getLocale, resolveLang } from "../i18n/index.ts"
import { detectCliLang } from "../utils/cli-utils.ts"
import { detectEncodingIssue, encodingWarning } from "../utils/encoding.ts"
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

  let rawText: string
  try {
    const buffer = await fs.promises.readFile(configPath)
    const issue = detectEncodingIssue(configPath, buffer)
    if (issue) console.warn(encodingWarning(issue, getLocale(detectCliLang())))
    rawText = new TextDecoder("utf-8").decode(buffer)
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

  let rawConfig: Record<string, unknown>
  try {
    rawConfig = JSON.parse(rawText) as Record<string, unknown>
  } catch (e) {
    return {
      config: null,
      issues: [
        {
          code: "parse",
          field: "config.json",
          message: `${folder}: config.json parse failed - ${(e as Error).message}`,
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
      console.log(locale.generatedText(path.basename(folderPath)))
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
        console.log(locale.autoWordCount(folder, story.wordCount, saveCounts))
      }

      if (saveCounts && story.wordCount !== config.wordCount) {
        await fs.promises.writeFile(
          path.join(folderPath, "config.json"),
          `${JSON.stringify({ ...config, wordCount: story.wordCount }, null, 2)}\n`,
          "utf-8",
        )
      }

      return { story, issues: [], contentWarnings }
    }),
  )

  for (const result of loadResults) {
    issues.push(...result.issues)
    warnings.push(...result.contentWarnings)
    if (result.story) stories.push(result.story)
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
