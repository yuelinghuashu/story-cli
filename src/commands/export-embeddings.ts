/**
 * `story export embeddings` 命令
 * 将 config 元数据 + 章节正文清洗为纯文本块（chunks），输出 JSONL
 * 设计：只清洗成干净文本块，不内置向量库——用户自行接 Chroma / LanceDB / OpenAI 等 embedding 服务
 * 与 ROADMAP「我们负责格式化，他们负责检索」一致
 */
import fs from "node:fs"
import path from "node:path"
import { splitSections } from "../core/content-parser.ts"
import { forEachExportStory, loadExportOverrides, resolveExportOptions, resolveOutputDir } from "../core/exporter.ts"
import type { StoryConfig } from "../core/types.ts"
import { getLocale } from "../i18n/index.ts"

/** 单个文本块 */
export interface EmbeddingChunk {
  folder: string
  title: string
  type: string
  chunkIndex: number
  /** 章节标题（无则空串） */
  chapter?: string
  text: string
}

/** 将正文清洗为文本块列表（按章节切分；无章节标题时整体为一块） */
export function chunkContent(folder: string, config: StoryConfig, content: string): EmbeddingChunk[] {
  const sections = splitSections(content)
  if (sections.length === 0) {
    return [{ folder, title: config.title, type: config.type, chunkIndex: 0, text: content.trim() }]
  }
  return sections.map((s, i) => ({
    folder,
    title: config.title,
    type: config.type,
    chunkIndex: i,
    chapter: s.title,
    text: s.rawContent.trim(),
  }))
}

/**
 * 导出全部故事为 embeddings JSONL
 * @param rootDir 项目根目录
 * @param args 命令行参数（--output=dist/embeddings.jsonl、--stdout）
 */
export function exportEmbeddings(rootDir: string, args: string[]): number {
  const { outputDir: relOutput, toStdout, cliLang } = resolveExportOptions(args, "dist")
  const outputDir = resolveOutputDir(rootDir, relOutput)
  const locale = getLocale(cliLang)

  if (!toStdout) {
    console.log(`${locale.embeddingsExporting}\n`)
  }

  const validationOverrides = loadExportOverrides(rootDir)
  const lines: string[] = []
  const { failed } = forEachExportStory(rootDir, validationOverrides, locale.embeddingsEmptyContent, (ctx) => {
    for (const chunk of chunkContent(ctx.folder, ctx.config, ctx.content)) {
      lines.push(JSON.stringify(chunk))
    }
  })

  if (toStdout) {
    process.stdout.write(`${lines.join("\n")}\n`)
    return failed > 0 ? 1 : 0
  }

  const outputPath = path.join(outputDir, "embeddings.jsonl")
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf-8")
  console.log(locale.embeddingsExportSuccess(lines.length, path.relative(rootDir, outputPath)))
  return failed > 0 ? 1 : 0
}
