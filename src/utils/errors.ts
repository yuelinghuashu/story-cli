/**
 * 统一错误处理模块
 * 提供带错误码 + 上下文的结构化错误类型
 */

/** 错误码常量 */
export const ErrorCode = {
  CONFIG_MISSING: "CONFIG_MISSING",
  CONFIG_PARSE: "CONFIG_PARSE",
  CONFIG_INVALID: "CONFIG_INVALID",
  STORY_NOT_FOUND: "STORY_NOT_FOUND",
  EMPTY_CONTENT: "EMPTY_CONTENT",
  EPUB_EXPORT: "EPUB_EXPORT",
  IMAGE_MISSING: "IMAGE_MISSING",
  IMAGE_READ: "IMAGE_READ",
  INVALID_ARGS: "INVALID_ARGS",
  WATCH_ERROR: "WATCH_ERROR",
} as const

/** 错误码类型 */
export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode]

/**
 * 自定义错误类型
 * 带机器可读的错误码和结构化上下文信息
 */
export class StoryError extends Error {
  /** 机器可读错误码 */
  readonly code: ErrorCodeValue
  /** 结构化上下文（便于调试和测试） */
  readonly context: Record<string, unknown>

  constructor(message: string, code: ErrorCodeValue, context: Record<string, unknown> = {}) {
    super(message)
    this.name = "StoryError"
    this.code = code
    this.context = context
  }
}

/**
 * 检查错误是否为 StoryError
 * @param error 任意错误
 * @returns 是否为 StoryError
 */
export function isStoryError(error: unknown): error is StoryError {
  return error instanceof StoryError
}

/**
 * 将 StoryError 转为可读的退出消息
 */
export function formatError(error: unknown): string {
  if (isStoryError(error)) {
    return `❌ [${error.code}] ${error.message}`
  }
  const msg = error instanceof Error ? error.message : String(error)
  return `❌ ${msg}`
}
