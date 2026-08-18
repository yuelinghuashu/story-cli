/**
 * 共享导出工具
 * 为 export-html / export-txt / export-json / export-md / epub 提供公共辅助函数
 */

import path from "node:path"
import { parseArgs } from "../args.ts"
import { detectCliLang, sanitizeFileName } from "../utils/cli-utils.ts"
import { formatError } from "../utils/errors.ts"
import { loadRepoConfig } from "./config.ts"
import { readStoryText, scanStoryFolders } from "./scanner.ts"
import { loadStoryConfig } from "./story-loader.ts"
import type { Language, StoryConfig } from "./types.ts"
import type { ValidationOverrides } from "./validate.ts"

/** 导出参数解析结果 */
export interface ResolvedExportOptions {
  outputDir: string
  toStdout: boolean
  cliLang: string
}

export function resolveExportOptions(args: string[], defaultOutput: string): ResolvedExportOptions {
  const { options } = parseArgs(args)
  return {
    outputDir: typeof options.output === "string" ? options.output : defaultOutput,
    toStdout: !!options.stdout,
    cliLang: detectCliLang(),
  }
}

export function loadExportOverrides(rootDir: string): ValidationOverrides {
  const repoConfig = loadRepoConfig(rootDir)
  return {
    types: repoConfig.types,
    statuses: repoConfig.statuses,
  }
}

/** 导出所需的仓库级配置（含本地化标签） */
export interface ExportRepoConfig {
  /** 校验覆盖 */
  overrides: ValidationOverrides
  /** 类型本地化标签 */
  typeLabels: Record<string, Record<string, string>>
  /** 状态本地化标签 */
  statusLabels: Record<string, Record<string, string>>
}

/**
 * 读取导出所需的完整仓库级配置
 * 供 export-html 等需要本地化标签的命令使用
 * @param rootDir 项目根目录
 * @returns 校验覆盖 + 本地化标签
 */
export function loadExportRepoConfig(rootDir: string): ExportRepoConfig {
  const repoConfig = loadRepoConfig(rootDir)
  return {
    overrides: loadExportOverrides(rootDir),
    typeLabels: repoConfig.typeLabels,
    statusLabels: repoConfig.statusLabels,
  }
}

export function resolveOutputDir(rootDir: string, relPath: string): string {
  return path.resolve(rootDir, relPath)
}

/**
 * 单个故事的导出上下文（forEachExportStory 传给 visit 回调）
 */
export interface ExportStoryContext {
  /** 故事文件夹名（如 "01-故事A"） */
  folder: string
  /** 故事文件夹绝对路径 */
  folderPath: string
  /** 校验后的故事配置 */
  config: StoryConfig
  /** 故事语言 */
  lang: Language
  /** 正文内容（text.md 或合并章节） */
  content: string
}

/**
 * 遍历所有故事并执行导出逻辑（export-json/md/txt/html 的公共骨架）
 * 统一处理：扫描 → 读取配置 → 读取正文 → 空内容警告跳过 → 回调 → 错误计数
 * @param rootDir 项目根目录
 * @param overrides 仓库级校验覆盖
 * @param emptyWarning 空正文的警告文案生成函数（各命令的本地化文案不同）
 * @param visit 每个有效故事的处理回调（成功即计数；抛错计入失败）
 * @returns 成功/失败故事数
 */
export function forEachExportStory(
  rootDir: string,
  overrides: ValidationOverrides,
  emptyWarning: (folder: string) => string,
  visit: (ctx: ExportStoryContext) => void,
): { success: number; failed: number } {
  const folders = scanStoryFolders(rootDir)
  let success = 0
  let failed = 0

  for (const folder of folders) {
    const folderPath = path.join(rootDir, folder)

    try {
      // 读取 + 校验故事配置
      const { config, lang } = loadStoryConfig(folderPath, folder, overrides)

      // 读取正文
      const { content } = readStoryText(folderPath)
      if (!content.trim()) {
        console.warn(emptyWarning(folder))
        failed++
        continue
      }

      visit({ folder, folderPath, config, lang, content })
      success++
    } catch (e) {
      console.error(formatError(e))
      failed++
    }
  }

  return { success, failed }
}

/**
 * 生成故事的输出文件名（安全标题，空标题回退到 story-<folder>）
 * @param config 故事配置
 * @param folder 故事文件夹名
 * @returns 安全文件名（不含扩展名）
 */
export function storyFileName(config: StoryConfig, folder: string): string {
  return sanitizeFileName(String(config.title)) || `story-${folder}`
}
