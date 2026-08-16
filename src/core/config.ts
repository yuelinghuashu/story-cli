/**
 * 仓库级配置模块
 * 支持根目录 story.config.json 覆盖默认类型/状态枚举及本地化标签
 * 无配置文件时回退到内置默认值（向后兼容）
 */

import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import { getLocale } from "../i18n/index.ts"
import { detectCliLang } from "../utils/cli-utils.ts"
import { detectEncodingIssue, encodingWarning } from "../utils/encoding.ts"
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
 * 回退到内置默认配置（解析失败或文件不存在时使用）
 */
function defaultRepoConfig(): LoadedRepoConfig {
  return {
    types: VALID_TYPES,
    statuses: VALID_STATUSES,
    typeLabels: { ...BUILTIN_TYPE_LABELS },
    statusLabels: { ...BUILTIN_STATUS_LABELS },
  }
}

/**
 * 共享：将原始仓库配置规范化为有效配置（纯逻辑，同步/异步版本共用）
 * @param raw 从 JSON 解析出的原始配置
 * @returns 规范化的有效配置（类型/状态列表 + 本地化标签）
 */
function normalizeRepoConfig(raw: StoryRepoConfig): LoadedRepoConfig {
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
}

/**
 * 共享：解析配置文件 Buffer（解码 + 编码检测 + JSON.parse）
 * @param configPath 配置文件路径（用于错误信息）
 * @param buffer 文件内容 Buffer
 * @returns 解析后的原始配置
 */
function parseConfigBuffer(configPath: string, buffer: Uint8Array): StoryRepoConfig {
  const issue = detectEncodingIssue(configPath, buffer)
  if (issue) console.warn(encodingWarning(issue, getLocale(detectCliLang())))
  return JSON.parse(new TextDecoder("utf-8").decode(buffer)) as StoryRepoConfig
}

/**
 * 共享：加载仓库级配置的内部逻辑（同步版本）
 * @param configPath 配置文件路径
 * @returns 有效类型和状态列表 + 本地化标签（存在时规范化，否则回退默认值）
 */
function loadRepoConfigSync(configPath: string): LoadedRepoConfig {
  if (!fs.existsSync(configPath)) return defaultRepoConfig()

  try {
    return normalizeRepoConfig(parseConfigBuffer(configPath, fs.readFileSync(configPath)))
  } catch {
    // 配置文件解析失败时回退默认值
    return defaultRepoConfig()
  }
}

/**
 * 共享：加载仓库级配置的内部逻辑（异步版本）
 * @param configPath 配置文件路径
 * @returns 有效类型和状态列表 + 本地化标签（存在时规范化，否则回退默认值）
 */
async function loadRepoConfigAsyncInternal(configPath: string): Promise<LoadedRepoConfig> {
  try {
    const buffer = await fsp.readFile(configPath)
    return normalizeRepoConfig(parseConfigBuffer(configPath, buffer))
  } catch {
    // 文件不存在或解析失败时回退默认值
    return defaultRepoConfig()
  }
}

/**
 * 读取仓库级配置（从根目录 story.config.json）
 * @param rootDir 项目根目录
 * @returns 有效类型和状态列表 + 本地化标签
 */
export function loadRepoConfig(rootDir: string): LoadedRepoConfig {
  return loadRepoConfigSync(path.join(rootDir, REPO_CONFIG_FILE))
}

/**
 * 异步读取仓库级配置（从根目录 story.config.json）
 * 与 loadRepoConfig 行为一致，但使用 fs/promises 避免阻塞事件循环
 * @param rootDir 项目根目录
 * @returns 有效类型和状态列表 + 本地化标签
 */
export async function loadRepoConfigAsync(rootDir: string): Promise<LoadedRepoConfig> {
  return loadRepoConfigAsyncInternal(path.join(rootDir, REPO_CONFIG_FILE))
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
