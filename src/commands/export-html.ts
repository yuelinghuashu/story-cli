import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "../args.ts"
import { loadRepoConfig } from "../core/config.ts"
import { readStoryText, resolveWordCount, scanStoryFolders } from "../core/scanner.ts"
import { loadStoryConfig } from "../core/story-loader.ts"
import type { ValidationOverrides } from "../core/validate.ts"
import { mdToHtml } from "../render/epub-generator.ts"
import { escapeHtml, PAGE_STYLE } from "../render/html-utils.ts"
import { detectCliLang } from "../utils/cli-utils.ts"
import { formatError } from "../utils/errors.ts"
import { formatStatus, formatType, getLocale } from "../utils/i18n.ts"

/** 类型/状态的本地化标签映射 */
type LabelMap = Record<string, Record<string, string>>

/**
 * 导出为静态 HTML 站点
 * @param rootDir 项目根目录
 * @param args 命令行参数（--output=dist/html）
 */
export function exportHtml(rootDir: string, args: string[]): number {
  // 解析参数
  const { options } = parseArgs(args)
  const outputDir = path.resolve(rootDir, typeof options.output === "string" ? options.output : "dist/html")
  const cliLang = detectCliLang()
  const locale = getLocale(cliLang)

  console.log(`${locale.htmlExporting}\n`)

  // 读取仓库级自定义枚举与本地化标签
  const repoConfig = loadRepoConfig(rootDir)
  const validationOverrides: ValidationOverrides = {
    types: repoConfig.types,
    statuses: repoConfig.statuses,
  }
  const typeLabels: LabelMap = repoConfig.typeLabels
  const statusLabels: LabelMap = repoConfig.statusLabels

  // 创建输出目录
  fs.mkdirSync(outputDir, { recursive: true })

  const folders = scanStoryFolders(rootDir)
  const storyItems: string[] = []
  let success = 0
  let failed = 0

  // 生成每个故事的 HTML 页面
  for (const folder of folders) {
    const folderPath = path.join(rootDir, folder)

    try {
      // 读取 + 校验故事配置
      const { config, lang } = loadStoryConfig(folderPath, folder, validationOverrides)

      // 读取正文
      const { content } = readStoryText(folderPath)
      if (!content.trim()) {
        console.warn(locale.htmlEmptyContent(folder))
        failed++
        continue
      }

      // 计算字数与展示文本
      const wordCount = resolveWordCount(config, content)
      const typeDisplay = formatType(config.type, lang, typeLabels)
      const statusDisplay = formatStatus(config.status, lang, statusLabels)
      const storyLocale = getLocale(lang)

      // 生成故事 HTML 页面
      const storyHtml = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(config.title)}</title>
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <a class="back" href="./index.html">${escapeHtml(storyLocale.backToStoryList)}</a>
  <h1>${escapeHtml(config.title)}</h1>
  <table>
    <tr><td><strong>${escapeHtml(storyLocale.typeLabel)}</strong></td><td>${escapeHtml(typeDisplay)}</td></tr>
    <tr><td><strong>${escapeHtml(storyLocale.wordCountLabel)}</strong></td><td>${escapeHtml(wordCount)}</td></tr>
    <tr><td><strong>${escapeHtml(storyLocale.statusLabel)}</strong></td><td>${escapeHtml(statusDisplay)}</td></tr>
    <tr><td><strong>${escapeHtml(storyLocale.createDateLabel)}</strong></td><td>${escapeHtml(config.created)}</td></tr>
  </table>
  ${config.summary ? `<h2>${escapeHtml(storyLocale.summaryTitle)}</h2><p>${escapeHtml(config.summary)}</p>` : ""}
  ${mdToHtml(content)}
</body>
</html>`

      fs.writeFileSync(path.join(outputDir, `${folder}.html`), storyHtml, "utf-8")

      // 收集索引项：使用本地化类型/状态显示
      storyItems.push(
        `<li><a href="./${encodeURIComponent(folder)}.html">${escapeHtml(config.title)}</a> — ${escapeHtml(
          typeDisplay,
        )} · ${escapeHtml(wordCount)} · ${escapeHtml(statusDisplay)}</li>`,
      )
      success++
    } catch (e) {
      console.error(formatError(e))
      failed++
    }
  }

  // 生成索引页
  const language = cliLang === "en" ? "en" : "zh"
  const indexTitle = cliLang === "en" ? "📚 My Stories" : "📚 我的故事集"
  const indexHtml = `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${indexTitle}</title>
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <h1>${indexTitle}</h1>
  ${
    storyItems.length === 0
      ? `<p>${cliLang === "en" ? "No stories yet." : "暂无故事。"}</p>`
      : `<ul>\n    ${storyItems.join("\n    ")}\n  </ul>`
  }
</body>
</html>`

  fs.writeFileSync(path.join(outputDir, "index.html"), indexHtml, "utf-8")

  const relativeOutput = path.relative(rootDir, outputDir) || "."
  console.log(locale.htmlExportSuccess(success, relativeOutput))
  if (failed > 0) {
    console.error(`  ⚠️ ${cliLang === "en" ? `${failed} stories skipped` : `${failed} 个故事已跳过`}`)
  }
  return failed > 0 ? 1 : 0
}
