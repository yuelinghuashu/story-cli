import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "../args.ts"
import { loadRepoConfig } from "../core/config.ts"
import { getNextNumber } from "../core/sequence.ts"
import type { Language } from "../core/types.ts"
import { validateConfig } from "../core/validate.ts"

/**
 * 创建新故事
 * @param rootDir 项目根目录
 * @param args 命令行参数
 */
export async function createNewStory(rootDir: string, args: string[]): Promise<void> {
  const { positional, options } = parseArgs(args)
  const title = positional[0]

  if (!title) {
    throw new Error(`Please specify a story title!
  Usage: story new "Title" [--type=original|fanfic] [--author="Work"] [--creator="Author"] [--lang=zh|en]

  Examples:
    story new "My First Story"
    story new "Fan Work" --type=fanfic --author="Original Work" --creator="Author" --lang=en
`)
  }

  // 正则：标题可以包含空格，但目录名不能有空格（用连字符替换）
  if (!/^[\w\u4e00-\u9fa5\s-]+$/.test(title)) {
    throw new Error(`Title can only contain letters, numbers, Chinese, spaces, underscores, and hyphens: ${title}`)
  }

  // 读取仓库级自定义类型（story.config.json），默认 original/fanfic
  const repoConfig = loadRepoConfig(rootDir)
  const validTypes = repoConfig.types
  const defaultType = validTypes[0] ?? "original"
  const type = typeof options.type === "string" ? options.type : defaultType

  if (!validTypes.includes(type)) {
    const choices = validTypes.map((v) => `"${v}"`).join(" or ")
    throw new Error(`--type must be ${choices}, got "${type}"`)
  }

  // 校验语言参数
  const lang: Language = typeof options.lang === "string" && options.lang === "en" ? "en" : "zh"

  const number = getNextNumber(rootDir)
  // 目录名将空格替换为连字符
  const folderName = `${number}-${title.replace(/\s+/g, "-")}`
  const folderPath = path.join(rootDir, folderName)

  if (fs.existsSync(folderPath)) {
    throw new Error(`Folder already exists: ${folderName}`)
  }

  fs.mkdirSync(folderPath, { recursive: true })

  const config: Record<string, unknown> = {
    title,
    type,
    status: "ongoing",
    isMultiChapter: false,
    language: lang,
    summary: lang === "zh" ? "一句话概括故事核心冲突和结局。" : "One-sentence summary of the story.",
    created: new Date().toISOString().slice(0, 10),
  }

  // 可选：指定作者名（原创故事）
  if (typeof options.author === "string" && options.author && type !== "fanfic") {
    config.author = options.author
  }

  if (type === "fanfic") {
    if (typeof options.author !== "string" || !options.author) {
      throw new Error(`Fan fiction requires --author="Original Work Name"`)
    }
    if (typeof options.creator !== "string" || !options.creator) {
      throw new Error(`Fan fiction requires --creator="Original Author"`)
    }
    config.originalWork = options.author
    config.originalAuthor = options.creator
  }

  // 使用共享 validateConfig 校验配置（与 import-json 行为一致）
  const validation = validateConfig(config, title, { types: validTypes })
  if (!validation.valid) {
    const issues = validation.issues.map((i) => i.message).join("; ")
    throw new Error(`Config validation failed: ${issues}`)
  }

  fs.writeFileSync(path.join(folderPath, "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf-8")

  const textContent = `# ${title}

${lang === "zh" ? "（在这里开始你的故事...）" : "(Start writing your story here...)"}
`
  fs.writeFileSync(path.join(folderPath, "text.md"), textContent, "utf-8")

  console.log(`✅ Created story: ${folderName}/`)
  console.log(`   ├── config.json (type: ${type})`)
  console.log(`   └── text.md`)
  console.log(`
Next steps:
  1. Edit ${folderName}/config.json
  2. Write in ${folderName}/text.md
  3. Run: story build
`)
}
