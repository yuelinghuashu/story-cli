/**
 * 声明式配置 Schema
 *
 * 定义 config.json 中每个字段的校验规则。
 * 所有规则通过统一的 validateConfig 引擎执行，
 * 新增字段只需在这里加一条描述即可，无需修改校验逻辑。
 */

import type { StoryConfig, StoryStatus, StoryType } from "./types.ts"

/** 合法的故事类型（内部统一英文代码） */
export const VALID_TYPES: StoryType[] = ["original", "fanfic"]

/** 合法的故事状态（内部统一英文代码） */
export const VALID_STATUSES: StoryStatus[] = ["completed", "ongoing"]

/** 合法的语言代码 */
export const VALID_LANGUAGES = ["zh", "en"] as const

/** 日期格式正则（YYYY-MM-DD） */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** 必填字段校验规则 */
const REQUIRED_FIELDS: (keyof StoryConfig)[] = ["title", "type", "status", "summary", "created"]

/** 字段级校验规则配置 */
interface FieldRule {
  /** 期望的 JS 类型 */
  type?: "string" | "boolean" | "number" | "string[]"
  /** 合法的枚举值列表 */
  enum?: readonly string[]
  /** 正则表达式 */
  pattern?: RegExp
}

/**
 * 字段级校验规则
 * key: 字段名
 * value: { type, enum, pattern }
 */
export const FIELD_RULES: Record<string, FieldRule> = {
  title: { type: "string" },
  type: { type: "string", enum: VALID_TYPES },
  status: { type: "string", enum: VALID_STATUSES },
  isMultiChapter: { type: "boolean" },
  language: { type: "string", enum: VALID_LANGUAGES },
  summary: { type: "string" },
  created: { type: "string", pattern: DATE_PATTERN },
  author: { type: "string" },
  originalWork: { type: "string" },
  originalAuthor: { type: "string" },
  wordCount: { type: "string" },
  cover: { type: "string" },
  series: { type: "string" },
  seriesOrder: { type: "number" },
  volume: { type: "string" },
  links: { type: "string[]" },
}

/**
 * 条件必填规则
 * key: 字段名
 * value: 判断函数（config 为参数，返回 true 时强制必填）
 */
export const CONDITIONAL_REQUIRED: Record<string, (config: StoryConfig) => boolean> = {
  originalWork: (config) => config.type === "fanfic",
  originalAuthor: (config) => config.type === "fanfic",
}

export { REQUIRED_FIELDS }
