/**
 * MCP 工具定义与分发
 * 复用 core/loader.ts 中已抽离的共享逻辑，遵循 ROADMAP「CLI 做原子能力，MCP 做适配层」
 */
import fs from "node:fs"
import path from "node:path"
import { generateReadmes } from "../commands/build.ts"
import { createStoryFromJson, type ImportStory } from "../commands/import-json.ts"
import { loadExportOverrides } from "../core/exporter.ts"
import { loadStories } from "../core/loader.ts"
import { readStoryTextAsync, scanStoryFolders, splitContentByChapters } from "../core/scanner.ts"
import { getNextNumber } from "../core/sequence.ts"
import type { McpToolResult, RegisteredTool } from "./protocol.ts"

/** 构造文本结果 */
function textResult(text: string, isError = false): McpToolResult {
  return { content: [{ type: "text", text }], isError }
}

/** 注册全部 MCP 工具 */
export function registerTools(rootDir: string): RegisteredTool[] {
  return [
    {
      tool: {
        name: "scan_stories",
        description:
          "列出所有故事及元数据（标题/类型/状态/字数/系列）。默认返回精简列表节省 Token；传 verbose=true 获取完整详情",
        inputSchema: {
          type: "object",
          properties: {
            verbose: { type: "boolean", description: "是否返回完整元数据（默认 false，仅返回精简列表）" },
          },
        },
      },
      handler: async (args) => {
        const { stories, issues, warnings } = await loadStories(rootDir, false, "zh", true)
        const verbose = args.verbose === true
        if (!verbose) {
          // 精简输出：只返回核心字段，减少 Token 开销
          const summary = stories.map((s) => ({
            folder: s.folder,
            title: s.config.title,
            type: s.config.type,
            status: s.config.status,
            lang: s.lang,
            wordCount: s.wordCount,
            summary: s.config.summary || "",
            series: s.config.series,
          }))
          return textResult(JSON.stringify({ stories: summary, issues, warnings }, null, 2))
        }
        return textResult(JSON.stringify({ stories, issues, warnings }, null, 2))
      },
    },
    {
      tool: {
        name: "read_chapter",
        description:
          "读取指定故事的章节内容（支持按章节索引按需加载）。tailLength 可只返回章节末尾 N 字符用于续写衔接，节省 Token",
        inputSchema: {
          type: "object",
          properties: {
            folder: { type: "string", description: "故事文件夹名（如 01-故事A）" },
            chapterIndex: {
              type: "number",
              description: "章节序号（0-based，可选；不提供则返回全部章节标题列表）",
            },
            tailLength: {
              type: "number",
              description: "只返回章节末尾 N 字符（可选；与 chapterIndex 配合使用，节省 Token）",
            },
          },
          required: ["folder"],
        },
      },
      handler: async (args) => {
        const folder = safeFolder(args.folder, rootDir)
        if (!folder) return textResult(`文件夹不存在: ${args.folder}`, true)
        const { content } = await readStoryTextAsync(path.join(rootDir, folder))
        if (!content.trim()) return textResult("故事正文为空", true)
        const chapters = splitContentByChapters(content)

        const rawIndex = args.chapterIndex
        if (typeof rawIndex === "number") {
          const index = Math.floor(rawIndex)
          if (index < 0 || index >= chapters.length) {
            return textResult(`章节索引超出范围: ${index}（共 ${chapters.length} 章）`, true)
          }
          const chapter = chapters[index]

          // tailLength 模式：只返回章节末尾 N 字符
          const rawTail = args.tailLength
          if (typeof rawTail === "number" && rawTail > 0) {
            const tailLength = Math.floor(rawTail)
            const totalLength = chapter.content.length
            if (chapter.content.length > tailLength) {
              return textResult(
                JSON.stringify(
                  {
                    folder,
                    chapterIndex: index,
                    chapterTitle: chapter.title,
                    truncated: true,
                    totalLength,
                    content: chapter.content.slice(-tailLength),
                  },
                  null,
                  2,
                ),
              )
            }
          }

          return textResult(JSON.stringify({ folder, chapter }, null, 2))
        }

        return textResult(
          JSON.stringify(
            { folder, chapterCount: chapters.length, chapters: chapters.map((c) => ({ title: c.title })) },
            null,
            2,
          ),
        )
      },
    },
    {
      tool: {
        name: "write_chapter",
        description: "将正文写入指定故事（原子写入 text.md）",
        inputSchema: {
          type: "object",
          properties: {
            folder: { type: "string", description: "故事文件夹名（如 01-故事A）" },
            content: { type: "string", description: "要写入的 Markdown 正文" },
          },
          required: ["folder", "content"],
        },
      },
      handler: async (args) => {
        const folder = safeFolder(args.folder, rootDir)
        if (!folder) return textResult(`文件夹不存在: ${args.folder}`, true)
        const content = typeof args.content === "string" ? args.content : ""
        if (!content.trim()) return textResult("内容不能为空", true)
        const tmpPath = path.join(rootDir, folder, ".text.md.tmp")
        await fs.promises.writeFile(tmpPath, content, "utf-8")
        await fs.promises.rename(tmpPath, path.join(rootDir, folder, "text.md"))
        return textResult(`✅ 已写入 ${folder}/text.md。请运行 build 更新 README。`)
      },
    },
    {
      tool: {
        name: "validate",
        description: "校验所有故事的 config.json 合法性",
        inputSchema: { type: "object", properties: {} },
      },
      handler: async () => {
        const { stories, issues } = await loadStories(rootDir, false, "zh", true)
        if (issues.length > 0) return textResult(JSON.stringify({ valid: false, issues }, null, 2))
        return textResult(JSON.stringify({ valid: true, storyCount: stories.length }, null, 2))
      },
    },
    {
      tool: {
        name: "build",
        description: "重建所有 README（等效 story build）。返回构建结果与捕获的输出日志",
        inputSchema: { type: "object", properties: {} },
      },
      handler: async () => {
        const { stories, issues, warnings } = await loadStories(rootDir, false, "zh", true)
        if (issues.length > 0) {
          return textResult(JSON.stringify({ success: false, storyCount: stories.length, issues }, null, 2), true)
        }
        const logs: string[] = []
        const readmeCount = generateReadmes(rootDir, stories, "zh", undefined, (msg) => logs.push(msg))
        return textResult(
          JSON.stringify({ success: true, storyCount: stories.length, readmeCount, warnings, logs }, null, 2),
        )
      },
    },
    {
      tool: {
        name: "stats",
        description: "获取故事库写作统计（总字数/章节数/系列分组/健康度）",
        inputSchema: { type: "object", properties: {} },
      },
      handler: async () => {
        const { stories, issues } = await loadStories(rootDir, false, "zh", true)
        const totalWords = stories.reduce((sum, s) => sum + s.rawWordCount, 0)
        const totalChapters = stories.reduce((sum, s) => sum + s.chapters.length, 0)
        const completedCount = stories.filter((s) => s.config.status === "completed").length
        const ongoingCount = stories.filter((s) => s.config.status === "ongoing").length

        // 系列分组统计
        const seriesMap = new Map<string, { count: number; totalWords: number }>()
        let standaloneCount = 0
        for (const s of stories) {
          const seriesName = s.config.series?.trim()
          if (seriesName) {
            const existing = seriesMap.get(seriesName) ?? { count: 0, totalWords: 0 }
            existing.count++
            existing.totalWords += s.rawWordCount
            seriesMap.set(seriesName, existing)
          } else {
            standaloneCount++
          }
        }

        // 健康度检查
        const healthWarnings: string[] = []
        for (const s of stories) {
          if (!s.config.summary || s.config.summary.trim() === "") {
            healthWarnings.push(`${s.folder}: 缺少 summary`)
          }
        }

        return textResult(
          JSON.stringify(
            {
              storyCount: stories.length,
              totalWords,
              totalChapters,
              completedCount,
              ongoingCount,
              standaloneCount,
              series: [...seriesMap.entries()].map(([name, stat]) => ({ name, ...stat })),
              health: { warnings: healthWarnings.length, items: healthWarnings },
              issues,
            },
            null,
            2,
          ),
        )
      },
    },
    {
      tool: {
        name: "import_json",
        description: "从结构化 JSON 批量导入故事（与 CLI `import json` 同构）",
        inputSchema: {
          type: "object",
          properties: {
            stories: {
              type: "array",
              description: "故事列表（title 必填，可选 type/status/language/summary/created/chapters）",
              items: { type: "object" },
            },
          },
          required: ["stories"],
        },
      },
      handler: async (args) => {
        const raw = args.stories
        if (!Array.isArray(raw) || raw.length === 0) return textResult("stories 必须是非空数组", true)
        const overrides = loadExportOverrides(rootDir)
        // 批量导入时只调用一次 getNextNumber 获取起始序号，循环内递增（避免重复扫描目录）
        let nextNumber = Number.parseInt(getNextNumber(rootDir), 10)
        let success = 0
        let failed = 0
        const created: string[] = []
        const errors: string[] = []
        for (const item of raw) {
          const story = item as Partial<ImportStory>
          if (!story || typeof story !== "object" || !story.title) {
            failed++
            errors.push(`第 ${success + failed} 条缺少 title`)
            continue
          }
          const number = String(nextNumber++).padStart(2, "0")
          const result = createStoryFromJson(rootDir, story as ImportStory, number, overrides)
          if (result) {
            success++
            created.push(result)
          } else {
            failed++
            errors.push(`导入失败: ${String(story.title)}`)
          }
        }
        return textResult(
          JSON.stringify({ success, failed, created, errors, nextStep: "请运行 story build 更新 README" }, null, 2),
        )
      },
    },
    {
      tool: {
        name: "create_story",
        description: "创建一个新故事（文件夹 + config.json + text.md 草稿）",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "故事标题（必填）" },
            type: { type: "string", description: "故事类型（默认 original）" },
            status: { type: "string", description: "状态（默认 ongoing）" },
            summary: { type: "string", description: "简介" },
            language: { type: "string", description: "语言（zh 或 en，默认 zh）" },
            series: { type: "string", description: "系列名称" },
            content: { type: "string", description: "初始正文（可选，作为第一章草稿写入）" },
          },
          required: ["title"],
        },
      },
      handler: async (args) => {
        const title = typeof args.title === "string" ? args.title.trim() : ""
        if (!title) return textResult("title 不能为空", true)

        const overrides = loadExportOverrides(rootDir)
        const number = getNextNumber(rootDir)
        const content = typeof args.content === "string" && args.content.trim() ? args.content.trim() : ""
        const chapters: Array<{ title: string; content: string }> = content ? [{ title: "第一章", content }] : []

        const story: Partial<ImportStory> = {
          title,
          type: typeof args.type === "string" ? args.type : undefined,
          status: typeof args.status === "string" ? args.status : undefined,
          language: typeof args.language === "string" ? args.language : undefined,
          summary: typeof args.summary === "string" ? args.summary : undefined,
          series: typeof args.series === "string" ? args.series : undefined,
          chapters,
        }

        const folder = createStoryFromJson(rootDir, story as ImportStory, number, overrides)
        if (!folder) {
          return textResult("创建失败：配置校验未通过或标题已存在", true)
        }
        return textResult(JSON.stringify({ success: true, folder, nextStep: "请运行 build 更新 README" }, null, 2))
      },
    },
  ]
}

/** 校验文件夹名是否存在（支持精确或前缀匹配，以及空格/连字符变体） */
function safeFolder(folder: unknown, rootDir: string): string | null {
  if (typeof folder !== "string" || !folder) return null
  const folders = scanStoryFolders(rootDir)
  // 同时尝试原始输入和「空格 → 连字符」变体：
  // createStoryFromJson 创建目录时会把标题中的空格转为连字符（如 "AI 创作的故事" → "AI-创作的故事"），
  // LLM 后续回传原始标题（带空格）时，需要这两种形式都能匹配
  const variants = new Set([folder, folder.replace(/\s+/g, "-")])
  for (const variant of variants) {
    const match = folders.find((f) => f === variant || f.startsWith(`${variant}-`))
    if (match) return match
  }
  return null
}
