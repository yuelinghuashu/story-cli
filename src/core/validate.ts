/**
 * 配置校验模块
 * 基于 src/schema.ts 的声明式规则驱动通用验证引擎
 */
import { CONDITIONAL_REQUIRED, FIELD_RULES, REQUIRED_FIELDS } from "./schema.ts"
import type { StoryConfig, ValidationIssue, ValidationResult } from "./types.ts"

export { VALID_STATUSES, VALID_TYPES } from "./schema.ts"

/** 可选的校验覆盖配置（仓库级） */
export interface ValidationOverrides {
  /** 合法的类型列表（默认内置 original/fanfic） */
  types?: readonly string[]
  /** 合法的状态列表（默认内置 completed/ongoing） */
  statuses?: readonly string[]
}

/**
 * 规范化配置（浅拷贝，供后续校验使用）
 * @param config 故事配置对象
 * @returns 规范化后的配置
 */
export function normalizeConfig(config: Record<string, unknown>): StoryConfig {
  return { ...config } as unknown as StoryConfig
}

/**
 * 根据 schema 规则校验配置
 * 返回结构化的 ValidationIssue 列表（含 code + field + value），便于上层格式化输出
 * @param config 故事配置对象
 * @param folder 故事文件夹名（用于错误提示）
 * @param overrides 可选校验覆盖（仓库级自定义枚举）
 * @returns 校验结果
 */
export function validateConfig(
  config: Record<string, unknown>,
  folder: string,
  overrides?: ValidationOverrides,
): ValidationResult {
  const issues: ValidationIssue[] = []
  const normalized = normalizeConfig(config)

  // 确定有效的枚举列表（优先使用仓库级覆盖）
  const effectiveTypes = overrides?.types?.length ? overrides.types : undefined
  const effectiveStatuses = overrides?.statuses?.length ? overrides.statuses : undefined

  // 必填字段
  const record = normalized as unknown as Record<string, unknown>
  for (const field of REQUIRED_FIELDS) {
    if (isMissing(record[field])) {
      issues.push({
        code: "missing",
        field,
        message: `${folder}: missing required field "${field}"`,
      })
    }
  }

  // 条件必填字段（如 fanfic 的 originalWork / originalAuthor）
  for (const [field, condition] of Object.entries(CONDITIONAL_REQUIRED)) {
    if (condition(normalized) && isMissing(record[field])) {
      issues.push({
        code: "conditional",
        field,
        message: `${folder}: fanfic must have "${field}"`,
      })
    }
  }

  // 字段级规则
  for (const [field, rules] of Object.entries(FIELD_RULES)) {
    const value = record[field]
    if (value === undefined) continue

    // 类型检查
    if (rules.type && typeof value !== rules.type) {
      issues.push({
        code: "type",
        field,
        message: `${folder}: "${field}" must be a ${rules.type}, got "${String(value)}"`,
        value,
      })
      continue
    }

    // 枚举检查：type 和 status 支持自定义列表
    if (field === "type" && effectiveTypes) {
      if (!effectiveTypes.includes(value as string)) {
        const choices = effectiveTypes.map((v) => `"${v}"`).join(" or ")
        issues.push({
          code: "enum",
          field,
          message: `${folder}: "${field}" must be ${choices}, got "${String(value)}"`,
          value,
        })
      }
    } else if (field === "status" && effectiveStatuses) {
      if (!effectiveStatuses.includes(value as string)) {
        const choices = effectiveStatuses.map((v) => `"${v}"`).join(" or ")
        issues.push({
          code: "enum",
          field,
          message: `${folder}: "${field}" must be ${choices}, got "${String(value)}"`,
          value,
        })
      }
    } else if (rules.enum && !rules.enum.includes(value as string)) {
      const choices = rules.enum.map((v) => `"${v}"`).join(" or ")
      issues.push({
        code: "enum",
        field,
        message: `${folder}: "${field}" must be ${choices}, got "${String(value)}"`,
        value,
      })
    }

    // 格式检查（正则）
    if (rules.pattern && !rules.pattern.test(value as string)) {
      issues.push({
        code: "pattern",
        field,
        message: `${folder}: "${field}" is invalid, got "${String(value)}"`,
        value,
      })
    }
  }

  return { valid: issues.length === 0, issues, normalized }
}

/**
 * 判断值是否缺失
 * @param value 检查的值
 * @returns 是否为空/缺失
 */
function isMissing(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "")
}

/**
 * 将校验问题转为可读错误消息
 * @param issues 校验问题列表
 * @returns 可读错误消息列表
 */
export function formatIssues(issues: ValidationIssue[]): string[] {
  return issues.map((i) => `❌ ${i.message}`)
}
