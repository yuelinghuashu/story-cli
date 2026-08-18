/**
 * MCP 工具定义与分发
 * 复用 core/loader.ts 中已抽离的共享逻辑，遵循 ROADMAP「CLI 做原子能力，MCP 做适配层」
 */
import fs from "node:fs"
import path from "node:path"
import { generateReadmes } from "../commands/build.ts"
import { createStoryFromJson, type ImportStory } from "../commands/import-json.ts"
import { checkRepoCompliance } from "../core/compliance.ts"
import { loadExportOverrides } from "../core/exporter.ts"
import { loadStories } from "../core/loader.ts"
import { readStoryTextAsync, scanStoryFolders, splitContentByChapters } from "../core/scanner.ts"
import { getNextNumber } from "../core/sequence.ts"
import { computeStoryStats, type StatsStoryInput } from "../core/stats-shared.ts"
import { validateConfig } from "../core/validate.ts"
import { getLocale } from "../i18n/index.ts"
import { safeTail } from "../utils/unicode.ts"
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
                    content: safeTail(chapter.content, tailLength),
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
        description:
          "将正文写入指定故事（原子写入 text.md）。validate=true 时写入后立即执行仓库合规检查并返回结果（不阻断写入）",
        inputSchema: {
          type: "object",
          properties: {
            folder: { type: "string", description: "故事文件夹名（如 01-故事A）" },
            content: { type: "string", description: "要写入的 Markdown 正文" },
            validate: { type: "boolean", description: "写后是否执行合规检查（默认 false）" },
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
        const base: Record<string, unknown> = { written: `${folder}/text.md` }

        // 可选：写后立即执行合规检查，把结果附在返回值中（不额外写盘）
        if (args.validate === true) {
          const result = checkRepoCompliance(rootDir, getLocale("zh"))
          base.compliance = {
            valid: result.valid,
            errorCount: result.issues.filter((i) => i.severity === "error").length,
            warningCount: result.issues.filter((i) => i.severity === "warning").length,
          }
        }

        return textResult(JSON.stringify({ ...base, nextStep: "请运行 build 更新 README" }, null, 2))
      },
    },
    {
      tool: {
        name: "edit_config",
        description:
          "更新故事 config.json 的元数据字段。可编辑：summary/status/series/seriesOrder/volume/links/author/originalWork/originalAuthor/cover/language/wordCount。字段值传 null 表示移除该可选字段。title/type/created/isMultiChapter 为身份或审计字段，禁止修改。写入前经仓库级 schema 校验，校验失败不写盘。修改后请运行 build 更新 README",
        inputSchema: {
          type: "object",
          properties: {
            folder: { type: "string", description: "故事文件夹名（如 01-故事A）" },
            fields: {
              type: "object",
              description: "要更新的字段（值为 null 时移除该可选字段）",
            },
          },
          required: ["folder", "fields"],
        },
      },
      handler: async (args) => {
        const folder = safeFolder(args.folder, rootDir)
        if (!folder) return textResult(`文件夹不存在: ${args.folder}`, true)

        const fields = args.fields
        if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
          return textResult("fields 必须是一个对象", true)
        }

        const configPath = path.join(rootDir, folder, "config.json")
        if (!fs.existsSync(configPath)) {
          return textResult(`缺少 config.json: ${folder}`, true)
        }

        let config: Record<string, unknown>
        try {
          config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>
        } catch {
          return textResult(`config.json 解析失败: ${folder}`, true)
        }

        // 可编辑白名单：治理性元数据；身份/审计字段拒绝
        const EDITABLE_FIELDS = new Set([
          "summary",
          "status",
          "series",
          "seriesOrder",
          "volume",
          "links",
          "author",
          "originalWork",
          "originalAuthor",
          "cover",
          "language",
          "wordCount",
        ])
        const rejected: string[] = []
        const updated: Record<string, unknown> = { ...config }
        for (const [key, value] of Object.entries(fields)) {
          if (!EDITABLE_FIELDS.has(key)) {
            rejected.push(key)
            continue
          }
          if (value === null) {
            // null = 移除可选字段
            delete updated[key]
          } else {
            updated[key] = value
          }
        }

        if (rejected.length > 0) {
          return textResult(
            JSON.stringify(
              {
                success: false,
                rejected: {
                  fields: rejected,
                  reason: "title/type/created/isMultiChapter 为身份或审计字段，不允许修改",
                },
              },
              null,
              2,
            ),
            true,
          )
        }

        // 仓库级 schema 校验（含自定义类型/状态枚举）；失败不写盘
        const overrides = loadExportOverrides(rootDir)
        const validation = validateConfig(updated, folder, overrides)
        if (!validation.valid) {
          return textResult(JSON.stringify({ success: false, issues: validation.issues }, null, 2), true)
        }

        // 原子写：tmp + rename（与 write_chapter 一致）
        const tmpPath = `${configPath}.tmp`
        await fs.promises.writeFile(tmpPath, `${JSON.stringify(updated, null, 2)}\n`, "utf-8")
        await fs.promises.rename(tmpPath, configPath)

        return textResult(
          JSON.stringify({ success: true, folder, config: updated, nextStep: "请运行 build 更新 README" }, null, 2),
        )
      },
    },
    {
      tool: {
        name: "validate",
        description: "检查仓库合规性（目录命名/必需文件/config schema/编码），等效 CLI `story validate`",
        inputSchema: { type: "object", properties: {} },
      },
      handler: async () => {
        const result = checkRepoCompliance(rootDir, getLocale("zh"))
        return textResult(JSON.stringify(result, null, 2))
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
        description: "获取故事库写作统计（总字数/章节数/系列分组/健康度/重复短语）",
        inputSchema: { type: "object", properties: {} },
      },
      handler: async () => {
        const { stories, issues } = await loadStories(rootDir, false, "zh", true)
        // 与 CLI `stats --json` 共用同一计算，保证两端口径一致
        const inputs: StatsStoryInput[] = stories.map((s) => ({
          folder: s.folder,
          status: s.config.status,
          series: s.config.series,
          configWordCount: s.config.wordCount,
          rawWordCount: s.rawWordCount,
          lang: s.lang,
          content: s.content,
        }))
        const aggregate = computeStoryStats(inputs, getLocale("zh"))

        return textResult(
          JSON.stringify(
            {
              ...aggregate,
              health: { warnings: aggregate.health.length, items: aggregate.health },
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
          links: Array.isArray(args.links) ? args.links.filter((l): l is string => typeof l === "string") : undefined,
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
