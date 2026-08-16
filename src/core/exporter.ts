/**
 * 共享导出工具
 * 为 export-html / export-txt / export-json / export-md 提供公共辅助函数
 */

import path from "node:path"
import { parseArgs } from "../args.ts"
import { detectCliLang } from "../utils/cli-utils.ts"
import { loadRepoConfig } from "./config.ts"
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
    overrides: {
      types: repoConfig.types,
      statuses: repoConfig.statuses,
    },
    typeLabels: repoConfig.typeLabels,
    statusLabels: repoConfig.statusLabels,
  }
}

export function resolveOutputDir(rootDir: string, relPath: string): string {
  return path.resolve(rootDir, relPath)
}
