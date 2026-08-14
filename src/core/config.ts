/**
 * 仓库级配置模块
 * 支持根目录 story.config.json 覆盖默认类型/状态枚举及本地化标签
 * 无配置文件时回退到内置默认值（向后兼容）
 */

import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import { VALID_STATUSES, VALID_TYPES } from "./schema.ts"

/** 单个枚举值的本地化标签（按语言映射） */
export type EnumLabel = Record<string, string>

/** 仓库级配置结构 */
export interface StoryRepoConfig {
  /** 自定义故事类型列表（默认：original, fanfic） */
  types?: string[]
  /** 自定义故事状态列表（默认：completed, ongoing） */
  statuses?: string[]
  /** 自定义类型的本地化标签（如 { "translation": { "zh": "翻译", "en": "Translation" } }） */
  typeLabels?: Record<string, EnumLabel>
  /** 自定义状态的本地化标签 */
  statusLabels?: Record<string, EnumLabel>
}

/** 加载并规范化后的仓库级配置 */
export interface LoadedRepoConfig {
  /** 有效类型列表 */
  types: readonly string[]
  /** 有效状态列表 */
  statuses: readonly string[]
  /** 类型本地化标签（可能为空） */
  typeLabels: Record<string, EnumLabel>
  /** 状态本地化标签（可能为空） */
  statusLabels: Record<string, EnumLabel>
}

const REPO_CONFIG_FILE = "story.config.json"

/** 内置类型的本地化标签（无需在配置中重复声明） */
const BUILTIN_TYPE_LABELS: Record<string, EnumLabel> = {
  original: { zh: "原创", en: "Original" },
  fanfic: { zh: "二创", en: "Fan Fiction" },
}

/** 内置状态的本地化标签 */
const BUILTIN_STATUS_LABELS: Record<string, EnumLabel> = {
  completed: { zh: "已完结", en: "Completed" },
  ongoing: { zh: "连载中", en: "Ongoing" },
}

/** 判断是否为合法的本地化标签对象 */
function isValidEnumLabel(value: unknown): value is EnumLabel {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.zh === "string" && typeof record.en === "string"
}

/** 规范化并校验本地化标签 */
function normalizeLabels(
  labels: Record<string, unknown> | undefined,
  builtin: Record<string, EnumLabel>,
  validKeys: readonly string[],
): Record<string, EnumLabel> {
  const result: Record<string, EnumLabel> = { ...builtin }

  if (!labels || typeof labels !== "object") return result

  for (const key of validKeys) {
    const label = (labels as Record<string, unknown>)[key]
    if (isValidEnumLabel(label)) {
      result[key] = label
    }
  }

  return result
}

/**
 * 读取仓库级配置（从根目录 story.config.json）
 * @param rootDir 项目根目录
 * @returns 有效类型和状态列表 + 本地化标签
 */
export function loadRepoConfig(rootDir: string): LoadedRepoConfig {
  const configPath = path.join(rootDir, REPO_CONFIG_FILE)

  if (!fs.existsSync(configPath)) {
    return {
      types: VALID_TYPES,
      statuses: VALID_STATUSES,
      typeLabels: { ...BUILTIN_TYPE_LABELS },
      statusLabels: { ...BUILTIN_STATUS_LABELS },
    }
  }

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as StoryRepoConfig
    const types =
      Array.isArray(raw.types) && raw.types.length > 0
        ? raw.types.filter((t): t is string => typeof t === "string")
        : VALID_TYPES
    const statuses =
      Array.isArray(raw.statuses) && raw.statuses.length > 0
        ? raw.statuses.filter((s): s is string => typeof s === "string")
        : VALID_STATUSES

    return {
      types,
      statuses,
      typeLabels: normalizeLabels(raw.typeLabels as Record<string, unknown> | undefined, BUILTIN_TYPE_LABELS, types),
      statusLabels: normalizeLabels(
        raw.statusLabels as Record<string, unknown> | undefined,
        BUILTIN_STATUS_LABELS,
        statuses,
      ),
    }
  } catch {
    // 配置解析失败时回退默认值
    return {
      types: VALID_TYPES,
      statuses: VALID_STATUSES,
      typeLabels: { ...BUILTIN_TYPE_LABELS },
      statusLabels: { ...BUILTIN_STATUS_LABELS },
    }
  }
}

/**
 * 异步读取仓库级配置（从根目录 story.config.json）
 * 与 loadRepoConfig 行为一致，但使用 fs/promises 避免阻塞事件循环
 * @param rootDir 项目根目录
 * @returns 有效类型和状态列表 + 本地化标签
 */
export async function loadRepoConfigAsync(rootDir: string): Promise<LoadedRepoConfig> {
  const configPath = path.join(rootDir, REPO_CONFIG_FILE)

  try {
    const raw = JSON.parse(await fsp.readFile(configPath, "utf-8")) as StoryRepoConfig
    const types =
      Array.isArray(raw.types) && raw.types.length > 0
        ? raw.types.filter((t): t is string => typeof t === "string")
        : VALID_TYPES
    const statuses =
      Array.isArray(raw.statuses) && raw.statuses.length > 0
        ? raw.statuses.filter((s): s is string => typeof s === "string")
        : VALID_STATUSES

    return {
      types,
      statuses,
      typeLabels: normalizeLabels(raw.typeLabels as Record<string, unknown> | undefined, BUILTIN_TYPE_LABELS, types),
      statusLabels: normalizeLabels(
        raw.statusLabels as Record<string, unknown> | undefined,
        BUILTIN_STATUS_LABELS,
        statuses,
      ),
    }
  } catch {
    // 文件不存在或解析失败时回退默认值
    return {
      types: VALID_TYPES,
      statuses: VALID_STATUSES,
      typeLabels: { ...BUILTIN_TYPE_LABELS },
      statusLabels: { ...BUILTIN_STATUS_LABELS },
    }
  }
}

/**
 * 检查值是否在类型列表中
 * @param value 要检查的值
 * @param types 类型列表
 * @returns 是否合法
 */
export function isValidType(value: string, types: readonly string[]): boolean {
  return types.includes(value)
}

/**
 * 检查值是否在状态列表中
 * @param value 要检查的值
 * @param statuses 状态列表
 * @returns 是否合法
 */
export function isValidStatus(value: string, statuses: readonly string[]): boolean {
  return statuses.includes(value)
}
