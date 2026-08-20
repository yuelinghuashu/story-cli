import fs from "node:fs"
import path from "node:path"
import { resolveRawWordCount, resolveWordCount, splitContentByChapters } from "../core/content-parser.ts"
import { ensureOutputDir, finishExport, forEachExportStory, initExport } from "../core/exporter.ts"
import type { StoryConfig } from "../core/types.ts"
import { resolveLang } from "../i18n/index.ts"

/** 单个章节的 JSON 结构 */
interface ExportChapter {
  title: string
  content: string
}

/** 单个故事的 JSON 结构 */
interface ExportStory {
  folder: string
  title: string
  type: string
  status: string
  language: string
  summary: string
  created: string
  wordCount: string
  rawWordCount: number
  chapters: ExportChapter[]
  author?: string
  originalWork?: string
  originalAuthor?: string
  series?: string
  seriesOrder?: number
  volume?: string
  cover?: string
}

/** 完整导出文件的根结构 */
interface ExportResult {
  version: string
  exportedAt: string
  storyCount: number
  stories: ExportStory[]
}

/**
 * 将单个故事转换为 JSON 结构
 * @param folder 故事文件夹名
 * @param config 校验后的故事配置
 * @param content 正文内容
 * @returns 结构化 JSON 条目
 */
function buildExportStory(folder: string, config: StoryConfig, content: string): ExportStory {
  const lang = resolveLang(config)

  const sections = splitContentByChapters(content)
  const chapters: ExportChapter[] =
    sections.length > 0
      ? sections.map((s) => ({ title: s.title, content: s.content }))
      : [{ title: String(config.title || folder), content }]

  const story: ExportStory = {
    folder,
    title: config.title,
    type: config.type,
    status: config.status,
    language: lang,
    summary: config.summary || "",
    created: config.created,
    wordCount: resolveWordCount(config, content),
    rawWordCount: resolveRawWordCount(content, lang),
    chapters,
  }

  // 可选元数据（仅在有值时包含）
  if (config.author) story.author = config.author
  if (config.originalWork) story.originalWork = config.originalWork
  if (config.originalAuthor) story.originalAuthor = config.originalAuthor
  if (config.series) story.series = config.series
  if (config.seriesOrder !== undefined) story.seriesOrder = config.seriesOrder
  if (config.volume) story.volume = config.volume
  if (config.cover) story.cover = config.cover

  return story
}

/**
 * 导出全部故事为结构化 JSON
 * 输出：{ version, exportedAt, storyCount, stories: [...] }
 * 供 AI 工作流、数据分析、Obsidian Dataview 等消费
 * @param rootDir 项目根目录
 * @param args 命令行参数（--output=dist/json、--stdout）
 */
export function exportJson(rootDir: string, args: string[]): number {
  const { outputDir, toStdout, locale, overrides } = initExport(rootDir, args, "dist/json")

  if (!toStdout) {
    console.log(`${locale.jsonExporting}\n`)
  }

  const stories: ExportStory[] = []
  const { failed } = forEachExportStory(rootDir, overrides, locale.jsonEmptyContent, (ctx) => {
    stories.push(buildExportStory(ctx.folder, ctx.config, ctx.content))
  })

  const result: ExportResult = {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    storyCount: stories.length,
    stories,
  }

  if (toStdout) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return failed > 0 ? 1 : 0
  }

  ensureOutputDir(false, outputDir)
  const outputPath = path.join(outputDir, "stories.json")
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8")

  return finishExport(rootDir, outputPath, stories.length, failed, locale, locale.jsonExportSuccess)
}
