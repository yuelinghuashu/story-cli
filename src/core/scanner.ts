import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import { getLocale } from "../i18n/index.ts"
import { detectCliLang } from "../utils/cli-utils.ts"
import { detectEncodingIssue, encodingWarning } from "../utils/encoding.ts"

/** 共享：解码 Buffer 并输出编码警告（同步/异步版本共用） */
function decodeBuffer(filePath: string, buffer: Uint8Array): string {
  const issue = detectEncodingIssue(filePath, buffer)
  if (issue) console.warn(encodingWarning(issue, getLocale(detectCliLang())))
  return new TextDecoder("utf-8").decode(buffer)
}

/** 读取文本文件并检测编码（同步） */
export function readTextFileChecked(filePath: string): string {
  return decodeBuffer(filePath, fs.readFileSync(filePath))
}

/** 读取文本文件并检测编码（异步） */
export async function readTextFileCheckedAsync(filePath: string): Promise<string> {
  return decodeBuffer(filePath, await fsp.readFile(filePath))
}

/** 需要排除的非故事目录（仅保留通用基础设施目录） */
export const EXCLUDE_DIRS = new Set([".git", "node_modules", "dist", "assets"])

/** .storyignore 文件名（控制 story-cli 扫描范围） */
const STORY_IGNORE_FILE = ".storyignore"

/** 故事文件夹命名模式：NN-名称（至少两位数字，保证数值序排序稳定） */
export const STORY_FOLDER_PATTERN = /^\d{2,}-.+/

/** 赞助图片约定目录（相对于项目根目录） */
const SPONSOR_DIR = "assets/sponsor"

/** 支持的赞助图片扩展名 */
const IMAGE_EXT_PATTERN = /\.(png|jpe?g|gif|webp|bmp)$/i

/**
 * .storyignore 规则：单个排除模式
 */
export interface StoryIgnoreRule {
  /** 原始模式字符串（如 "_draft" / "*.tmp"） */
  pattern: string
  /** 是否仅匹配目录（模式以 / 结尾） */
  isDirOnly: boolean
  /** 编译后的匹配正则 */
  regex: RegExp
}

/**
 * 加载 .storyignore 规则（.gitignore 简化子集）
 * 支持的语法：
 *   - 注释行（# 开头）
 *   - 精确匹配：_draft
 *   - 目录匹配（/ 结尾）：_draft/
 *   - 通配符（*）：*.tmp、chapter-*~
 * 明确不支持：! 取反、** 递归、/ 锚定、[abc] 字符类
 * @param rootDir 项目根目录
 * @returns 解析后的规则列表（文件不存在时返回空数组）
 */
export function loadStoryIgnore(rootDir: string): StoryIgnoreRule[] {
  const ignorePath = path.join(rootDir, STORY_IGNORE_FILE)
  if (!fs.existsSync(ignorePath)) return []

  try {
    const content = readTextFileChecked(ignorePath)
    return parseIgnoreRules(content)
  } catch {
    // .storyignore 读取失败时静默忽略（不阻断构建）
    return []
  }
}

/** 转义正则特殊字符 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * 解析 .storyignore 文本内容为规则列表（纯函数，同步/异步版本共享）
 * 支持的语法：
 *   - 注释行（# 开头）
 *   - 精确匹配：_draft
 *   - 目录匹配（/ 结尾）：_draft/
 *   - 通配符（*）：*.tmp、chapter-*~
 * 明确不支持：! 取反、** 递归、/ 锚定、[abc] 字符类
 * @param content .storyignore 文件内容
 * @returns 解析后的规则列表
 */
export function parseIgnoreRules(content: string): StoryIgnoreRule[] {
  const rules: StoryIgnoreRule[] = []

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim()
    // 跳过空行和注释
    if (!line || line.startsWith("#")) continue

    const isDirOnly = line.endsWith("/")
    const pattern = isDirOnly ? line.slice(0, -1) : line

    // 将简化 glob 转为正则：* → [^/]*（不跨越目录分隔符）
    const regexSource = `^${pattern.split("*").map(escapeRegExp).join("[^/]*")}$`
    rules.push({ pattern, isDirOnly, regex: new RegExp(regexSource) })
  }

  return rules
}

/**
 * 判断名称是否被 .storyignore 规则匹配
 * @param name 文件或目录名
 * @param isDir 是否为目录
 * @param rules 解析后的规则列表
 * @returns 是否被忽略
 */
export function isIgnored(name: string, isDir: boolean, rules: StoryIgnoreRule[]): boolean {
  return rules.some((rule) => (!rule.isDirOnly || isDir) && rule.regex.test(name))
}

/**
 * 获取赞助图片列表（约定目录 assets/sponsor/ 中的图片）
 * @param rootDir 项目根目录
 * @returns 图片相对路径列表（如 ["assets/sponsor/ali-pay.jpg"]）
 */
export function getSponsorImages(rootDir: string): string[] {
  const sponsorPath = path.join(rootDir, SPONSOR_DIR)

  if (!fs.existsSync(sponsorPath)) return []

  try {
    return fs
      .readdirSync(sponsorPath)
      .filter((f) => IMAGE_EXT_PATTERN.test(f))
      .map((f) => path.join(SPONSOR_DIR, f))
      .sort()
  } catch {
    return []
  }
}

/**
 * 从文件夹名提取数字前缀（用于排序）
 * @param folder 文件夹名（如 "01-故事A"）
 * @returns 数字前缀（如 1）
 */
export function getFolderNumber(folder: string): number {
  return parseInt(folder.split("-")[0], 10)
}

/**
 * 共享：从目录项名称列表筛选出故事文件夹（纯逻辑，不涉及 IO）
 * @param items 目录项名称列表
 * @param ignoreRules .storyignore 规则列表
 * @param isDir 判断名称是否为目录的函数
 * @returns 排序后的故事文件夹名称列表
 */
function selectStoryFolders(
  items: string[],
  ignoreRules: StoryIgnoreRule[],
  isDir: (name: string) => boolean,
): string[] {
  return items
    .filter((item) => {
      if (EXCLUDE_DIRS.has(item)) return false
      if (!STORY_FOLDER_PATTERN.test(item)) return false
      if (isIgnored(item, true, ignoreRules)) return false
      return isDir(item)
    })
    .sort((a, b) => getFolderNumber(a) - getFolderNumber(b))
}

/**
 * 共享：从目录项名称列表筛选出 chapter-*.md 文件并排序（纯逻辑，不涉及 IO）
 * 使用自然排序（numeric: true）：chapter-2.md 排在 chapter-10.md 之前，
 * 兼容未按两位补零的章节文件（chapter-1.md / chapter-2.md / chapter-10.md）
 * @param items 目录项名称列表
 * @returns 排序后的 chapter 文件名列表
 */
export function selectChapterFiles(items: string[]): string[] {
  return items
    .filter((f) => /^chapter-.*\.md$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

/**
 * 扫描根目录下的故事文件夹
 * @param rootDir 项目根目录
 * @returns 按数字前缀排序后的故事文件夹名称列表
 */
export function scanStoryFolders(rootDir: string): string[] {
  // 读取 .storyignore 规则（不存在时返回空数组，行为与现状一致）
  const ignoreRules = loadStoryIgnore(rootDir)

  let entries: fs.Dirent[]
  try {
    // 使用 withFileTypes 避免额外的 statSync 系统调用
    entries = fs.readdirSync(rootDir, { withFileTypes: true })
  } catch {
    return []
  }

  // 预先构建目录名集合（withFileTypes 直接提供类型信息，无需逐个 stat）
  const dirNames = new Set(entries.filter((e) => e.isDirectory()).map((e) => e.name))

  return selectStoryFolders(
    entries.map((e) => e.name),
    ignoreRules,
    (item) => dirNames.has(item),
  )
}

/**
 * 异步扫描根目录下的故事文件夹
 * 与 scanStoryFolders 行为一致，但使用 fs/promises 避免阻塞事件循环
 * @param rootDir 项目根目录
 * @returns 排序后的故事文件夹名称列表
 */
export async function scanStoryFoldersAsync(rootDir: string): Promise<string[]> {
  // 读取 .storyignore 规则（不存在时返回空数组）
  const ignoreRules = await loadStoryIgnoreAsync(rootDir)

  let items: string[]
  try {
    items = await fsp.readdir(rootDir)
  } catch {
    return []
  }

  // 并行 stat，构建目录集合（避免逐个顺序 stat）
  const statResults = await Promise.all(
    items.map(async (item) => {
      try {
        return { item, isDir: (await fsp.stat(path.join(rootDir, item))).isDirectory() }
      } catch {
        return { item, isDir: false }
      }
    }),
  )
  const dirNames = new Set(statResults.filter((r) => r.isDir).map((r) => r.item))

  return selectStoryFolders(items, ignoreRules, (item) => dirNames.has(item))
}

/**
 * 检查是否存在序号重复的故事文件夹
 * @param rootDir 项目根目录
 * @returns 重复的序号列表（去重后的序号字符串）
 */
export function checkDuplicateNumbers(rootDir: string): string[] {
  const folders = scanStoryFolders(rootDir)
  const seen = new Map<string, string>()
  const duplicates = new Set<string>()

  for (const folder of folders) {
    const num = folder.split("-")[0]
    const existing = seen.get(num)
    if (existing !== undefined) {
      duplicates.add(num)
    } else {
      seen.set(num, folder)
    }
  }

  return [...duplicates].sort()
}

/**
 * 异步加载 .storyignore 规则
 * 与 loadStoryIgnore 行为一致，但使用 fs/promises 避免阻塞事件循环
 * @param rootDir 项目根目录
 * @returns 解析后的规则列表
 */
export async function loadStoryIgnoreAsync(rootDir: string): Promise<StoryIgnoreRule[]> {
  const ignorePath = path.join(rootDir, STORY_IGNORE_FILE)

  try {
    return parseIgnoreRules(await readTextFileCheckedAsync(ignorePath))
  } catch {
    // .storyignore 读取失败时静默忽略（不阻断构建）
    return []
  }
}
