/**
 * 统一错误处理工具
 * 提供一致的错误处理模式，避免代码重复
 *
 * 用法示例：
 *   try { ... } catch (e) { throw handleFileSystemError(e, filePath, "读取配置") }
 *   try { ... } catch (e) { throw handleJsonParseError(e, filePath) }
 */

import { ErrorCode, isStoryError, StoryError } from "./errors.ts"

/**
 * 错误上下文类型
 */
export interface ErrorContext {
  /** 操作名称（如 "读取配置文件"） */
  operation?: string
  /** 文件路径 */
  filePath?: string
  /** 模块名称 */
  module?: string
  /** 额外数据 */
  [key: string]: unknown
}

/**
 * 安全的类型守卫：检查是否为 Node.js 文件系统错误
 *
 * @param error 任意错误
 * @returns 是否为 NodeJS.ErrnoException
 */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

/**
 * 统一错误归一化函数
 * 将任意错误转换为 StoryError，保留已有 StoryError 不变
 *
 * @param error 捕获的错误
 * @param context 错误上下文
 * @returns StoryError 实例
 */
export function normalizeError(error: unknown, context?: ErrorContext): StoryError {
  if (isStoryError(error)) {
    return context ? new StoryError(error.message, error.code, { ...error.context, ...context }) : error
  }

  const message = error instanceof Error ? error.message : String(error)
  return new StoryError(message, ErrorCode.CONFIG_PARSE, context || {})
}

/**
 * 处理文件系统错误
 * 将 Node.js fs 错误映射为对应 StoryError
 *
 * @param error 捕获的错误
 * @param filePath 文件路径
 * @param operation 操作描述（如 "读取配置"）
 * @returns StoryError 实例
 */
export function handleFileSystemError(error: unknown, filePath: string, operation: string): StoryError {
  const context: ErrorContext = { operation, filePath }

  if (isNodeError(error)) {
    if (error.code === "ENOENT") {
      return new StoryError(`${operation}: 文件不存在 - ${filePath}`, ErrorCode.FILE_NOT_FOUND, context)
    }
    if (error.code === "EACCES") {
      return new StoryError(`${operation}: 权限不足 - ${filePath}`, ErrorCode.FILE_READ, context)
    }
    return new StoryError(`${operation}: 文件系统错误 - ${error.message}`, ErrorCode.FILE_READ, {
      ...context,
      code: error.code,
    })
  }

  return normalizeError(error, context)
}

/**
 * 处理 JSON 解析错误
 *
 * @param error 捕获的错误
 * @param filePath JSON 文件路径
 * @returns StoryError 实例
 */
export function handleJsonParseError(error: unknown, filePath: string): StoryError {
  const context: ErrorContext = { operation: "JSON 解析", filePath }

  if (isNodeError(error)) {
    return handleFileSystemError(error, filePath, "JSON 解析")
  }

  if (error instanceof SyntaxError) {
    return new StoryError(`JSON 解析失败: ${filePath} - ${error.message}`, ErrorCode.JSON_PARSE, context)
  }

  return normalizeError(error, context)
}

/**
 * 批量错误收集器
 * 用于收集多个操作中的错误，最后统一处理
 */
export class ErrorCollector {
  private errors: StoryError[] = []
  private context: ErrorContext

  constructor(context: ErrorContext) {
    this.context = context
  }

  /** 添加错误到收集器 */
  add(error: unknown, additionalContext?: ErrorContext): void {
    const normalized = normalizeError(error, { ...this.context, ...additionalContext })
    this.errors.push(normalized)
  }

  /** 检查是否有错误 */
  hasErrors(): boolean {
    return this.errors.length > 0
  }

  /** 获取所有错误 */
  getErrors(): StoryError[] {
    return [...this.errors]
  }

  /** 获取第一个错误（如果存在） */
  getFirstError(): StoryError | null {
    return this.errors[0] || null
  }

  /** 将所有错误转换为 ValidationIssue 兼容格式 */
  toValidationIssues(): Array<{ code: string; field: string; message: string }> {
    return this.errors.map((error) => ({
      code: error.code,
      field: this.context.operation || "unknown",
      message: error.message,
    }))
  }

  /** 清空错误收集器 */
  clear(): void {
    this.errors = []
  }
}
