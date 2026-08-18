/**
 * 仓库合规检查（Story-Repo 标准 v2.0 的合规检查器）
 * 供 CLI `story validate` 命令与 MCP `validate` 工具复用，保证两端口径一致
 *
 * 检查维度：
 * - 目录命名规范（NN- 前缀，至少两位数字）
 * - 必需文件（config.json + text.md 或 chapter-*.md）
 * - config.json 可解析且符合 schema（复用 validateConfig，含仓库级自定义枚举）
 * - 重复序号检测
 * - 文件编码（UTF-8）
 */
import fs from "node:fs"
import path from "node:path"
import type { Locale } from "../i18n/index.ts"
import { detectEncodingIssue } from "../utils/encoding.ts"
import { parseJsonBuffer } from "../utils/json-utils.ts"
import { loadRepoConfig } from "./config.ts"
import { EXCLUDE_DIRS, loadStoryIgnore, STORY_FOLDER_PATTERN } from "./scanner.ts"
import { type ValidationOverrides, validateConfig } from "./validate.ts"

/** 合规问题严重级别 */
export type ComplianceSeverity = "error" | "warning"

/** 单条合规问题 */
export interface ComplianceIssue {
  /** 严重级别：error（名录/文件/schema 违规）或 warning（编码/重复序号等软性问题） */
  severity: ComplianceSeverity
  /** 问题类型 */
  code: string
  /** 涉及的文件夹（无则空串） */
  folder: string
  /** 人类可读消息 */
  message: string
}

/** 单个故事的合规结果 */
export interface StoryCompliance {
  folder: string
  /** config.json 是否可解析且通过 schema（null = 无 config.json） */
  configValid: boolean | null
  /** 是否缺少正文（text.md 且无 chapter-*.md） */
  missingContent: boolean
}

/** 合规检查结果 */
export interface ComplianceResult {
  /** 是否完全合规（无 error 级别问题） */
  valid: boolean
  /** 故事目录总数 */
  storyCount: number
  issues: ComplianceIssue[]
  /** 各故事的合规详情（JSON 模式输出） */
  stories: StoryCompliance[]
}

/**
 * 检查仓库合规性
 * @param rootDir 项目根目录
 * @param locale 文案
 * @returns 结构化合规结果
 */
export function checkRepoCompliance(rootDir: string, locale: Locale): ComplianceResult {
  const issues: ComplianceIssue[] = []
  const stories: StoryCompliance[] = []

  // 仓库级自定义枚举
  const repoConfig = loadRepoConfig(rootDir)
  const overrides: ValidationOverrides = { types: repoConfig.types, statuses: repoConfig.statuses }
  const ignoreRules = loadStoryIgnore(rootDir)

  // 扫描根目录下的所有目录项，识别故事目录与违规目录
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true })
  } catch {
    return { valid: false, storyCount: 0, issues: [], stories }
  }

  const isIgnoredDir = (name: string): boolean =>
    EXCLUDE_DIRS.has(name) || ignoreRules.some((r) => r.isDirOnly && r.regex.test(name))

  const storyFolders: string[] = []
  // 检查目录命名规范
  for (const entry of entries) {
    if (!entry.isDirectory() || isIgnoredDir(entry.name)) continue
    if (STORY_FOLDER_PATTERN.test(entry.name)) {
      storyFolders.push(entry.name)
    } else if (looksLikeStoryDir(path.join(rootDir, entry.name))) {
      // 目录内含 config.json / text.md / chapter-*.md（"看起来想当故事"）却不符合 NN- 命名规范
      // 普通项目文件夹（如 docs/、.github/ 及用户自定义目录）不含故事特征文件，不会被误报
      issues.push({
        severity: "warning",
        code: "invalid-folder-name",
        folder: entry.name,
        message: locale.complianceInvalidFolderName(entry.name),
      })
    }
  }

  storyFolders.sort()

  // 重复序号检测
  const seen = new Map<string, string>()
  for (const folder of storyFolders) {
    const num = folder.split("-")[0]
    const existing = seen.get(num)
    if (existing !== undefined) {
      issues.push({
        severity: "warning",
        code: "duplicate-number",
        folder,
        message: locale.complianceDuplicateNumber(num, existing, folder),
      })
    } else {
      seen.set(num, folder)
    }
  }

  // 每个故事的合规检查
  for (const folder of storyFolders) {
    const folderPath = path.join(rootDir, folder)
    const storyStatus = checkStory(folder, folderPath, overrides)
    stories.push(storyStatus)

    // config 问题
    if (storyStatus.configValid === null) {
      issues.push({
        severity: "error",
        code: "missing-config",
        folder,
        message: locale.complianceMissingConfig(folder),
      })
    } else if (storyStatus.configValid === false) {
      issues.push({
        severity: "error",
        code: "invalid-config",
        folder,
        message: locale.complianceInvalidConfig(folder),
      })
    }

    // 正文缺失
    if (storyStatus.missingContent) {
      issues.push({
        severity: "error",
        code: "missing-content",
        folder,
        message: locale.complianceMissingContent(folder),
      })
    }

    // 编码检测（config.json 与 text.md）
    for (const file of ["config.json", "text.md"]) {
      const filePath = path.join(folderPath, file)
      if (!fs.existsSync(filePath)) continue
      const buffer = fs.readFileSync(filePath)
      const enc = detectEncodingIssue(filePath, buffer)
      if (enc) {
        issues.push({
          severity: "warning",
          code: "encoding",
          folder,
          message: locale.complianceEncoding(folder, file),
        })
      }
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length
  return {
    valid: errorCount === 0,
    storyCount: storyFolders.length,
    issues,
    stories,
  }
}

/** 检查单个故事的 config 与正文存在性 */
function checkStory(folder: string, folderPath: string, overrides: ValidationOverrides): StoryCompliance {
  const configPath = path.join(folderPath, "config.json")
  if (!fs.existsSync(configPath)) {
    return { folder, configValid: null, missingContent: computesMissingContent(folderPath) }
  }

  let configValid: boolean
  try {
    const raw = parseJsonBuffer(configPath, fs.readFileSync(configPath))
    configValid = validateConfig(raw, folder, overrides).valid
  } catch {
    configValid = false
  }

  return { folder, configValid, missingContent: computesMissingContent(folderPath) }
}

/** 判断故事是否缺少正文（既无 text.md 也无 chapter-*.md） */
function computesMissingContent(folderPath: string): boolean {
  if (fs.existsSync(path.join(folderPath, "text.md"))) return false
  try {
    return !fs.readdirSync(folderPath).some((f) => /^chapter-.*\.md$/i.test(f))
  } catch {
    return true
  }
}

/**
 * 判断一个目录是否"看起来想当故事"（内含故事特征文件）
 * 用于 invalid-folder-name 检查：只有当目录内含 config.json / text.md / chapter-*.md
 * 却未使用 NN- 命名时，才提示命名不规范；普通项目文件夹不会被误报。
 * @param folderPath 目录绝对路径
 * @returns 是否含故事特征文件
 */
function looksLikeStoryDir(folderPath: string): boolean {
  return (
    fs.existsSync(path.join(folderPath, "config.json")) ||
    fs.existsSync(path.join(folderPath, "text.md")) ||
    (() => {
      try {
        return fs.readdirSync(folderPath).some((f) => /^chapter-.*\.md$/i.test(f))
      } catch {
        return false
      }
    })()
  )
}
