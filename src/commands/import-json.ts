import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "../args.ts"
import { loadRepoConfig } from "../core/config.ts"
import { type ValidationOverrides, validateConfig } from "../core/validate.ts"
import { getLocale } from "../i18n/index.ts"
import { detectCliLang, sanitizeFileName } from "../utils/cli-utils.ts"

/** 从 JSON 导入的单个故事结构（与 export json 对称） */
export interface ImportStory {
  /** 故事标题（必填） */
  title: string
  /** 故事类型（必填，默认 original） */
  type?: string
  /** 故事状态（必填，默认 ongoing） */
  status?: string
  /** 故事语言（默认 zh） */
  language?: string
  /** 简介 */
  summary?: string
  /** 创建日期（YYYY-MM-DD，缺失时自动填充当天） */
  created?: string
  /** 作者名（可选） */
  author?: string
  /** 原作名称（fanfic 可选） */
  originalWork?: string
  /** 原作者（fanfic 可选） */
  originalAuthor?: string
  /** 系列名称（可选） */
  series?: string
  /** 系列内排序（可选） */
  seriesOrder?: number
  /** 卷/册名称（可选） */
  volume?: string
  /** 封面路径（可选） */
  cover?: string
  /** 章节列表 */
  chapters: Array<{ title: string; content: string }>
}

/** 从 JSON 导入的根结构 */
export interface ImportResult {
  version?: string
  stories: ImportStory[]
}

/**
 * 获取下一个序号（复用 new-story.ts 逻辑）
 * @param rootDir 项目根目录
 * @returns 两位数字序号
 */
function getNextNumber(rootDir: string): string {
  const folders = fs.readdirSync(rootDir).filter((item) => /^\d{2,}-/.test(item))
  let max = 0
  for (const folder of folders) {
    const num = parseInt(folder.split("-")[0], 10)
    if (!Number.isNaN(num) && num > max) max = num
  }
  return String(max + 1).padStart(2, "0")
}

/**
 * 从 JSON 数据创建单个故事
 * @param rootDir 目标根目录
 * @param story 故事数据
 * @param number 分配的文件夹序号
 * @param overrides 仓库级校验覆盖
 * @returns 创建的文件夹名（失败时返回 null）
 */
function createStoryFromJson(
  rootDir: string,
  story: ImportStory,
  number: string,
  overrides: ValidationOverrides,
): string | null {
  // 基础校验
  if (!story.title || typeof story.title !== "string" || !story.title.trim()) {
    return null
  }

  // 组装 config（对齐 schema.ts 的必填字段）
  const config: Record<string, unknown> = {
    title: story.title.trim(),
    type: story.type || "original",
    status: story.status || "ongoing",
    isMultiChapter: story.chapters.length > 1,
    language: story.language === "en" ? "en" : "zh",
    summary: story.summary?.trim() || "",
    created: story.created || new Date().toISOString().slice(0, 10),
  }

  // 可选元数据（仅在有值时包含）
  if (story.author) config.author = story.author
  if (story.originalWork) config.originalWork = story.originalWork
  if (story.originalAuthor) config.originalAuthor = story.originalAuthor
  if (story.series) config.series = story.series
  if (story.seriesOrder !== undefined) config.seriesOrder = story.seriesOrder
  if (story.volume) config.volume = story.volume
  if (story.cover) config.cover = story.cover

  // 使用现有校验逻辑验证配置（含仓库级自定义枚举）
  const validation = validateConfig(config, story.title, overrides)
  if (!validation.valid) {
    const issues = validation.issues.map((i) => i.message).join("; ")
    console.warn(`  ⚠️ ${story.title}: ${issues}`)
    return null
  }

  // 规范化后的目录名（标题空格转连字符）
  const folderName = `${number}-${story.title.trim().replace(/\s+/g, "-")}`
  // 使用 sanitizeFileName 处理可能含非法字符的标题
  const safeFolder = sanitizeFileName(folderName) || `story-${number}`
  const folderPath = path.join(rootDir, safeFolder)

  // 检查是否已存在相同标题的故事（防止导入重复内容，幂等性）
  const storyTitle = story.title.trim().replace(/\s+/g, "-")
  const existingTitle = fs
    .readdirSync(rootDir)
    .filter((f) => /^\d{2,}-/.test(f))
    .some((f) => f.replace(/^\d{2,}-/, "") === storyTitle)
  if (existingTitle) {
    console.warn(`  ⚠️ ${story.title}: 相同标题的故事已存在，已跳过`)
    return null
  }

  // 目录已存在时跳过（防御性检查）
  if (fs.existsSync(folderPath)) {
    console.warn(`  ⚠️ ${safeFolder}: 目录已存在，已跳过（使用 --overwrite 覆盖）`)
    return null
  }

  fs.mkdirSync(folderPath, { recursive: true })

  // 写 config.json（格式化后保留可读性）
  fs.writeFileSync(path.join(folderPath, "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf-8")

  // 写正文：单章节 → text.md；多章节 → chapter-*.md
  const chapters = story.chapters?.filter((c) => c?.title && c.content?.trim()) || []

  if (chapters.length <= 1) {
    // 单章节（或无章节）：合并为 text.md
    const body = chapters[0]?.content?.trim() || ""
    const content = body ? `# ${chapters[0]?.title}\n\n${body}\n` : ""
    fs.writeFileSync(path.join(folderPath, "text.md"), content, "utf-8")
  } else {
    // 多章节：生成 chapter-01.md、chapter-02.md ...
    chapters.forEach((chapter, index) => {
      const chapterFile = `chapter-${String(index + 1).padStart(2, "0")}.md`
      fs.writeFileSync(path.join(folderPath, chapterFile), `# ${chapter.title}\n\n${chapter.content.trim()}\n`, "utf-8")
    })
  }

  return safeFolder
}

/**
 * 导入结构化 JSON 为故事仓库
 * 与 export json 对称：export json 的输出可以直接作为 import 的输入
 * @param rootDir 目标根目录
 * @param args CLI 参数（--file=stories.json / --output=my-stories/ / --overwrite）
 * @returns 退出码（0 成功，1 失败）
 */
export function importJson(rootDir: string, args: string[]): number {
  const { options } = parseArgs(args)
  const cliLang = detectCliLang()
  const locale = getLocale(cliLang)

  // 解析输入源：--file=xxx.json 或 stdin
  const filePath = typeof options.file === "string" ? options.file : null
  const outputDir = path.resolve(rootDir, typeof options.output === "string" ? options.output : ".")

  console.log(`${locale.importJsonReading}\n`)

  let rawInput: string
  try {
    if (filePath) {
      const resolvedPath = path.resolve(rootDir, filePath)
      if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ ${locale.importJsonFileNotFound(resolvedPath)}`)
        return 1
      }
      rawInput = fs.readFileSync(resolvedPath, "utf-8")
    } else {
      // 从 stdin 读取（支持管道）
      rawInput = fs.readFileSync(0, "utf-8")
      if (!rawInput.trim()) {
        console.error(`❌ ${locale.importJsonEmptyInput}`)
        console.log(`\n  ${locale.importJsonUsage}`)
        return 1
      }
    }
  } catch (e) {
    console.error(`❌ ${locale.importJsonReadFailed(String(e))}`)
    return 1
  }

  // 解析 JSON
  let data: ImportResult
  try {
    data = JSON.parse(rawInput) as ImportResult
  } catch (e) {
    console.error(`❌ ${locale.importJsonParseError(String(e))}`)
    return 1
  }

  // 校验根结构
  if (!data || !Array.isArray(data.stories)) {
    console.error(`❌ ${locale.importJsonInvalidFormat}`)
    console.log(`\n  ${locale.importJsonUsage}`)
    return 1
  }

  // 确保输出目录存在
  if (outputDir !== rootDir) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // 读取仓库级自定义枚举
  const repoConfig = loadRepoConfig(outputDir)
  const validationOverrides: ValidationOverrides = {
    types: repoConfig.types,
    statuses: repoConfig.statuses,
  }

  let success = 0
  let failed = 0

  for (let i = 0; i < data.stories.length; i++) {
    const story = data.stories[i]
    if (!story || typeof story !== "object" || !story.title) {
      console.warn(`  ⚠️ ${locale.importJsonMissingTitle(i + 1)}`)
      failed++
      continue
    }

    // 分配到下一个可用序号
    const number = getNextNumber(outputDir)
    const created = createStoryFromJson(outputDir, story, number, validationOverrides)

    if (created) {
      console.log(`  ✅ ${created}/`)
      success++
    } else {
      failed++
    }
  }

  const relativeOutput = path.relative(rootDir, outputDir) || "."
  console.log(`\n${locale.importJsonDone(success, failed)}`)
  if (success > 0) {
    console.log(`  📁 ${locale.importJsonOutputDir(path.join(relativeOutput))}`)
    console.log(`  📝 ${locale.importJsonNextStep}`)
  }
  return failed > 0 ? 1 : 0
}
