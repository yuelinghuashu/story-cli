import fs from "node:fs"
import path from "node:path"
import { forEachExportStory, loadExportRepoConfig, resolveExportOptions, resolveOutputDir } from "../core/exporter.ts"
import { resolveWordCount } from "../core/scanner.ts"
import { formatStatus, formatType, getLocale } from "../i18n/index.ts"
import { escapeHtml, PAGE_STYLE } from "../render/html-utils.ts"
import { mdToHtml } from "../render/md-to-html.ts"

/**
 * 导出为静态 HTML 站点
 * @param rootDir 项目根目录
 * @param args 命令行参数（--output=dist/html）
 */
export function exportHtml(rootDir: string, args: string[]): number {
  // 解析参数
  const { outputDir: relOutput, cliLang } = resolveExportOptions(args, "dist/html")
  const outputDir = resolveOutputDir(rootDir, relOutput)
  const locale = getLocale(cliLang)

  console.log(`${locale.htmlExporting}\n`)

  // 读取仓库级自定义枚举与本地化标签
  const { overrides: validationOverrides, typeLabels, statusLabels } = loadExportRepoConfig(rootDir)

  // 创建输出目录
  fs.mkdirSync(outputDir, { recursive: true })

  const storyItems: string[] = []
  const { success, failed } = forEachExportStory(rootDir, validationOverrides, locale.htmlEmptyContent, (ctx) => {
    const { config, lang, content, folder } = ctx

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
  })

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
    console.error(locale.skippedExport(failed))
  }
  return failed > 0 ? 1 : 0
}
