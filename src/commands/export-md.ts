import fs from "node:fs"
import path from "node:path"
import { loadExportOverrides, resolveExportOptions, resolveOutputDir } from "../core/exporter.ts"
import { readStoryText, scanStoryFolders } from "../core/scanner.ts"
import { loadStoryConfig } from "../core/story-loader.ts"
import type { StoryConfig } from "../core/types.ts"
import { getLocale, resolveLang } from "../i18n/index.ts"
import { sanitizeFileName } from "../utils/cli-utils.ts"
import { formatError } from "../utils/errors.ts"

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
    // 字符串值带引号（避免 YAML 解析边界问题）
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
 * @param config 校验后的故事配置
 * @param content 正文内容
 * @returns 合并后的完整 Markdown 内容
 */
function buildMergedMarkdown(config: StoryConfig, content: string): string {
  const frontmatter = buildYamlFrontmatter(config)

  // 正文直接保留原始 Markdown（text.md 或合并后的 chapter-*.md）
  // 章节内容本身已包含 # 标题，无需额外处理
  return `${frontmatter}${content.trim()}\n`
}

/**
 * 导出全部故事为单文件 Markdown（含 YAML Frontmatter）
 * 适合跨平台搬运（论坛、邮件、朋友分享）或作为便携备份
 * @param rootDir 项目根目录
 * @param args 命令行参数（--output=dist/md）
 */
export function exportMd(rootDir: string, args: string[]): number {
  const { outputDir: relOutput, toStdout, cliLang } = resolveExportOptions(args, "dist/md")
  const outputDir = resolveOutputDir(rootDir, relOutput)
  const locale = getLocale(cliLang)

  if (!toStdout) {
    console.log(`${locale.mdExporting}\n`)
  }

  // 读取仓库级自定义枚举
  const validationOverrides = loadExportOverrides(rootDir)

  // stdout 模式：不需要创建输出目录；文件模式：创建输出目录
  if (!toStdout) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const folders = scanStoryFolders(rootDir)
  let success = 0
  let failed = 0
  const sections: string[] = []

  for (const folder of folders) {
    const folderPath = path.join(rootDir, folder)

    try {
      // 读取 + 校验故事配置
      const { config } = loadStoryConfig(folderPath, folder, validationOverrides)

      // 读取正文
      const { content } = readStoryText(folderPath)
      if (!content.trim()) {
        console.warn(locale.mdEmptyContent(folder))
        failed++
        continue
      }

      // 合并 Markdown
      const merged = buildMergedMarkdown(config, content)

      if (toStdout) {
        // stdout 模式：收集到数组，最后统一按分隔符拼接输出
        sections.push(merged.trim())
        success++
      } else {
        // 输出文件：以配置标题命名（安全文件名）
        const safeTitle = sanitizeFileName(String(config.title)) || `story-${folder}`
        const outputPath = path.join(outputDir, `${safeTitle}.md`)
        fs.writeFileSync(outputPath, merged, "utf-8")
        success++
      }
    } catch (e) {
      console.error(formatError(e))
      failed++
    }
  }

  // stdout 模式：按分隔符拼接输出（管道友好）
  if (toStdout) {
    process.stdout.write(`${sections.join("\n\n<!-- story-separator -->\n\n")}\n`)
    return failed > 0 ? 1 : 0
  }

  const relativeOutput = path.relative(rootDir, outputDir) || "."
  console.log(locale.mdExportSuccess(success, relativeOutput))
  if (failed > 0) {
    console.error(`  ⚠️ ${cliLang === "en" ? `${failed} stories skipped` : `${failed} 个故事已跳过`}`)
  }
  return failed > 0 ? 1 : 0
}
