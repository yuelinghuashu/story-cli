import fs from "node:fs"
import path from "node:path"
import { ensureOutputDir, finishExport, forEachExportStory, initExport, storyFileName } from "../core/exporter.ts"

/**
 * 导出全部故事为纯文本文件（.txt）
 * @param rootDir 项目根目录
 * @param args 命令行参数（--output=dist/txt）
 */
export function exportTxt(rootDir: string, args: string[]): number {
  const { outputDir, toStdout, locale, overrides } = initExport(rootDir, args, "dist/txt")

  if (!toStdout) {
    console.log(`${locale.txtExporting}\n`)
  }

  ensureOutputDir(toStdout, outputDir)

  const sections: string[] = []
  const { success, failed } = forEachExportStory(rootDir, overrides, locale.txtEmptyContent, (ctx) => {
    if (toStdout) {
      const titleLine = `================\n${String(ctx.config.title)}\n================`
      sections.push(`${titleLine}\n\n${ctx.content.trim()}`)
    } else {
      const safeTitle = storyFileName(ctx.config, ctx.folder)
      fs.writeFileSync(path.join(outputDir, `${safeTitle}.txt`), ctx.content, "utf-8")
    }
  })

  if (toStdout) {
    process.stdout.write(`${sections.join("\n\n====\n\n")}\n`)
    return failed > 0 ? 1 : 0
  }

  return finishExport(rootDir, outputDir, success, failed, locale, locale.txtExportSuccess)
}
