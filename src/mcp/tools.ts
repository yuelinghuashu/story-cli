/**
 * MCP 工具定义与分发
 * 复用 core/loader.ts 中已抽离的共享逻辑，遵循 ROADMAP「CLI 做原子能力，MCP 做适配层」
 */
import fs from "node:fs"
import path from "node:path"
import { createStoryFromJson, type ImportStory } from "../commands/import-json.ts"
import { loadRepoConfig } from "../core/config.ts"
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
        description: "列出所有故事及元数据（标题/类型/状态/字数/系列）",
        inputSchema: { type: "object", properties: {} },
      },
      handler: async () => {
        const { stories, issues, warnings } = await loadStories(rootDir, false, "zh", true)
        return textResult(JSON.stringify({ stories, issues, warnings }, null, 2))
      },
    },
    {
      tool: {
        name: "read_chapter",
        description: "读取指定故事的章节正文（按需加载，节省 Token）",
        inputSchema: {
          type: "object",
          properties: {
            folder: { type: "string", description: "故事文件夹名（如 01-故事A）" },
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
        return textResult(JSON.stringify({ folder, chapters }, null, 2))
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
        return textResult(`✅ 已写入 ${folder}/text.md。请运行 story build 更新 README。`)
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
        description: "触发 README 与索引重建（等效 story build）",
        inputSchema: { type: "object", properties: {} },
      },
      handler: async () => textResult("请运行 `story build` 命令来完成 README 重建（MCP 不代理有副作用的 CLI 输出）。"),
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
        const repoConfig = loadRepoConfig(rootDir)
        const overrides = { types: repoConfig.types, statuses: repoConfig.statuses }
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
          const number = getNextNumber(rootDir)
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
  ]
}

/** 校验文件夹名是否存在（支持精确或前缀匹配） */
function safeFolder(folder: unknown, rootDir: string): string | null {
  if (typeof folder !== "string" || !folder) return null
  const folders = scanStoryFolders(rootDir)
  return folders.find((f) => f === folder || f.startsWith(`${folder}-`)) ?? null
}
