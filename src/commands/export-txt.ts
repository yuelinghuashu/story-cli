import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "../args.ts"
import { loadRepoConfig } from "../core/config.ts"
import { readStoryText, scanStoryFolders } from "../core/scanner.ts"
import { loadStoryConfig } from "../core/story-loader.ts"
import type { ValidationOverrides } from "../core/validate.ts"
import { detectCliLang, sanitizeFileName } from "../utils/cli-utils.ts"
import { formatError } from "../utils/errors.ts"
import { getLocale } from "../utils/i18n.ts"

/**
 * 导出全部故事为纯文本文件（.txt）
 * @param rootDir 项目根目录
 * @param args 命令行参数（--output=dist/txt）
 */
export function exportTxt(rootDir: string, args: string[]): number {
  // 解析参数
  const { options } = parseArgs(args)
  const outputDir = path.resolve(rootDir, typeof options.output === "string" ? options.output : "dist/txt")
  const cliLang = detectCliLang()
  const locale = getLocale(cliLang)

  console.log(`${locale.txtExporting}\n`)

  // 读取仓库级自定义枚举
  const repoConfig = loadRepoConfig(rootDir)
  const validationOverrides: ValidationOverrides = {
    types: repoConfig.types,
    statuses: repoConfig.statuses,
  }

  // 创建输出目录
  fs.mkdirSync(outputDir, { recursive: true })

  const folders = scanStoryFolders(rootDir)
  let success = 0
  let failed = 0

  for (const folder of folders) {
    const folderPath = path.join(rootDir, folder)

    try {
      // 读取 + 校验故事配置
      const { config } = loadStoryConfig(folderPath, folder, validationOverrides)

      // 读取正文
      const { content } = readStoryText(folderPath)
      if (!content.trim()) {
        console.warn(locale.txtEmptyContent(folder))
        failed++
        continue
      }

      // 安全文件名 + 输出路径
      const safeTitle = sanitizeFileName(String(config.title)) || `story-${folder}`
      const outputPath = path.join(outputDir, `${safeTitle}.txt`)

      // 写入纯文本（保留 Markdown 原始格式，作为纯文字稿）
      fs.writeFileSync(outputPath, content, "utf-8")
      success++
    } catch (e) {
      console.error(formatError(e))
      failed++
    }
  }

  const relativeOutput = path.relative(rootDir, outputDir) || "."
  console.log(locale.txtExportSuccess(success, relativeOutput))
  if (failed > 0) {
    console.error(`  ⚠️ ${cliLang === "en" ? `${failed} stories skipped` : `${failed} 个故事已跳过`}`)
  }
  return failed > 0 ? 1 : 0
}
