import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "../args.ts"
import { loadRepoConfig } from "../core/config.ts"
import { getNextNumber } from "../core/sequence.ts"
import type { Language } from "../core/types.ts"
import { validateConfig } from "../core/validate.ts"
import { getLocale } from "../i18n/index.ts"
import { detectCliLang, sanitizeFileName } from "../utils/cli-utils.ts"

/**
 * 创建新故事
 * @param rootDir 项目根目录
 * @param args 命令行参数
 */
export async function createNewStory(rootDir: string, args: string[]): Promise<void> {
  const { positional, options } = parseArgs(args)
  const title = positional[0]
  const locale = getLocale(detectCliLang())

  // 空标题（含纯空白）视为缺失：在创建目录前拦截，避免留下孤儿目录
  if (!title?.trim()) {
    throw new Error(locale.newMissingTitle)
  }

  // 读取仓库级自定义类型（story.config.json），默认 original/fanfic
  const repoConfig = loadRepoConfig(rootDir)
  const validTypes = repoConfig.types
  const defaultType = validTypes[0] ?? "original"
  const type = typeof options.type === "string" ? options.type : defaultType

  if (!validTypes.includes(type)) {
    throw new Error(locale.newTypeInvalid(validTypes as string[], type))
  }

  // 校验语言参数
  const lang: Language = typeof options.lang === "string" && options.lang === "en" ? "en" : "zh"

  const number = getNextNumber(rootDir)
  // 目录名：空格转连字符 + 非法字符净化（与 import json / MCP create_story 行为一致）
  const folderName = sanitizeFileName(`${number}-${title.trim().replace(/\s+/g, "-")}`) || `story-${number}`
  const folderPath = path.join(rootDir, folderName)

  if (fs.existsSync(folderPath)) {
    throw new Error(locale.newFolderExists(folderName))
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
      throw new Error(locale.newFanficRequiresAuthor)
    }
    if (typeof options.creator !== "string" || !options.creator) {
      throw new Error(locale.newFanficRequiresCreator)
    }
    config.originalWork = options.author
    config.originalAuthor = options.creator
  }

  // 使用共享 validateConfig 校验配置（与 import-json 行为一致）
  const validation = validateConfig(config, title, { types: validTypes })
  if (!validation.valid) {
    const issues = validation.issues.map((i) => i.message).join("; ")
    throw new Error(locale.newConfigInvalid(issues))
  }

  fs.writeFileSync(path.join(folderPath, "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf-8")

  const textContent = `# ${title}

${lang === "zh" ? "（在这里开始你的故事...）" : "(Start writing your story here...)"}
`
  fs.writeFileSync(path.join(folderPath, "text.md"), textContent, "utf-8")

  console.log(locale.newCreated(folderName, type))
  console.log(locale.newNextSteps(folderName))
}
