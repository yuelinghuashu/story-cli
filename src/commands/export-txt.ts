import fs from "node:fs"
import path from "node:path"
import {
  forEachExportStory,
  loadExportOverrides,
  resolveExportOptions,
  resolveOutputDir,
  storyFileName,
} from "../core/exporter.ts"
import { getLocale } from "../i18n/index.ts"

/**
 * 导出全部故事为纯文本文件（.txt）
 * @param rootDir 项目根目录
 * @param args 命令行参数（--output=dist/txt）
 */
export function exportTxt(rootDir: string, args: string[]): number {
  // 解析参数
  const { outputDir: relOutput, toStdout, cliLang } = resolveExportOptions(args, "dist/txt")
  const outputDir = resolveOutputDir(rootDir, relOutput)
  const locale = getLocale(cliLang)

  if (!toStdout) {
    console.log(`${locale.txtExporting}\n`)
  }

  // 读取仓库级自定义枚举
  const validationOverrides = loadExportOverrides(rootDir)

  // stdout 模式：不需要创建输出目录；文件模式：创建输出目录
  if (!toStdout) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const sections: string[] = []
  const { success, failed } = forEachExportStory(rootDir, validationOverrides, locale.txtEmptyContent, (ctx) => {
    if (toStdout) {
      // stdout 模式：每个故事加标题行 + 收集到数组
      const titleLine = `================\n${String(ctx.config.title)}\n================`
      sections.push(`${titleLine}\n\n${ctx.content.trim()}`)
    } else {
      // 安全文件名 + 输出路径
      const safeTitle = storyFileName(ctx.config, ctx.folder)
      const outputPath = path.join(outputDir, `${safeTitle}.txt`)

      // 写入纯文本（保留 Markdown 原始格式，作为纯文字稿）
      fs.writeFileSync(outputPath, ctx.content, "utf-8")
    }
  })

  // stdout 模式：按分隔符拼接输出（管道友好；纯文本使用 = 号而非 HTML 注释）
  if (toStdout) {
    process.stdout.write(`${sections.join("\n\n====\n\n")}\n`)
    return failed > 0 ? 1 : 0
  }

  const relativeOutput = path.relative(rootDir, outputDir) || "."
  console.log(locale.txtExportSuccess(success, relativeOutput))
  if (failed > 0) {
    console.error(locale.skippedExport(failed))
  }
  return failed > 0 ? 1 : 0
}
