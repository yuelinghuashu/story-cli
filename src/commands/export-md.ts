import fs from "node:fs"
import path from "node:path"
import { ensureOutputDir, finishExport, forEachExportStory, initExport, storyFileName } from "../core/exporter.ts"
import type { StoryConfig } from "../core/types.ts"
import { resolveLang } from "../i18n/index.ts"

/** 可序列化的元数据值 */
type MetaValue = string | number | boolean | null

/**
 * 将 config.json 转为 YAML Frontmatter 格式的元数据
 * 只包含非空的值，避免输出冗余字段
 */
function buildYamlFrontmatter(config: StoryConfig): string {
  const meta: Record<string, MetaValue | string[]> = {
    title: config.title,
    type: config.type,
    status: config.status,
    language: resolveLang(config),
    summary: config.summary || "",
    created: config.created,
  }

  // 可选元数据（仅在有值时包含）
  if (config.author) meta.author = config.author
  if (config.originalWork) meta.originalWork = config.originalWork
  if (config.originalAuthor) meta.originalAuthor = config.originalAuthor
  if (config.series) meta.series = config.series
  if (config.seriesOrder !== undefined) meta.seriesOrder = config.seriesOrder
  if (config.volume) meta.volume = config.volume
  if (config.cover) meta.cover = config.cover

  const lines = Object.entries(meta).map(([key, value]) => {
    if (typeof value === "string") {
      const escaped = value.replace(/"/g, '\\"')
      return `${key}: "${escaped}"`
    }
    return `${key}: ${String(value)}`
  })

  return `---\n${lines.join("\n")}\n---\n\n`
}

/**
 * 将单个故事导出为单文件 Markdown
 * 结构：YAML Frontmatter + 正文（含章节标题）
 */
function buildMergedMarkdown(config: StoryConfig, content: string): string {
  const frontmatter = buildYamlFrontmatter(config)
  return `${frontmatter}${content.trim()}\n`
}

/**
 * 导出全部故事为单文件 Markdown（含 YAML Frontmatter）
 * 适合跨平台搬运（论坛、邮件、朋友分享）或作为便携备份
 * @param rootDir 项目根目录
 * @param args 命令行参数（--output=dist/md）
 */
export function exportMd(rootDir: string, args: string[]): number {
  const { outputDir, toStdout, locale, overrides } = initExport(rootDir, args, "dist/md")

  if (!toStdout) {
    console.log(`${locale.mdExporting}\n`)
  }

  ensureOutputDir(toStdout, outputDir)

  const sections: string[] = []
  const { success, failed } = forEachExportStory(rootDir, overrides, locale.mdEmptyContent, (ctx) => {
    const merged = buildMergedMarkdown(ctx.config, ctx.content)

    if (toStdout) {
      sections.push(merged.trim())
    } else {
      const safeTitle = storyFileName(ctx.config, ctx.folder)
      fs.writeFileSync(path.join(outputDir, `${safeTitle}.md`), merged, "utf-8")
    }
  })

  if (toStdout) {
    process.stdout.write(`${sections.join("\n\n<!-- story-separator -->\n\n")}\n`)
    return failed > 0 ? 1 : 0
  }

  return finishExport(rootDir, outputDir, success, failed, locale, locale.mdExportSuccess)
}
