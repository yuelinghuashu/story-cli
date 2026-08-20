/**
 * 项目常量定义
 * 消除魔法数字，提高代码可读性
 */

/**
 * 字数统计相关常量
 */
export const WORD_COUNT_THRESHOLDS = {
  /** 千字阈值 */
  THOUSAND: 1000,
  /** 万字阈值 */
  TEN_THOUSAND: 10000,
  /** 百万字阈值 */
  MILLION: 1000000,
} as const

/**
 * 文件操作相关常量
 */
export const FILE_OPERATIONS = {
  /** 默认超时时间 (ms) */
  DEFAULT_TIMEOUT: 1000,
  /** 文件读取超时时间 (ms) */
  READ_TIMEOUT: 1000,
  /** 命令执行超时时间 (ms) */
  COMMAND_TIMEOUT: 1000,
} as const

/**
 * 缓存相关常量
 */
export const CACHE_CONFIG = {
  /** 缓存版本 */
  VERSION: 1,
  /** 缓存文件名 */
  FILENAME: ".story-cache.json",
  /** 缓存有效期 (ms) - 24小时 */
  TTL: 24 * 60 * 60 * 1000,
} as const

/**
 * 文件路径相关常量
 */
export const FILE_PATHS = {
  /** 配置文件名 */
  CONFIG_FILE: "config.json",
  /** 故事正文文件名 */
  TEXT_FILE: "text.md",
  /** 章节文件前缀 */
  CHAPTER_PREFIX: "chapter-",
  /** 输出目录 */
  OUTPUT_DIR: "dist",
} as const

/**
 * 错误码常量
 */
export const ERROR_CODES = {
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
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  INVALID_PATH: "INVALID_PATH",
  FILE_SYSTEM_ERROR: "FILE_SYSTEM_ERROR",
  JSON_PARSE_ERROR: "JSON_PARSE_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const

/**
 * 正则表达式常量
 */
export const REGEX_PATTERNS = {
  /** CJK 字符范围 */
  CJK_CHARS: /[\u4e00-\u9fa5\u3400-\u4dbf\u{20000}-\u{2A6DF}]/gu,
  /** 英文单词 */
  ENGLISH_WORDS: /[A-Za-z0-9]+(?:[''-][A-Za-z0-9]+)*/g,
  /** 数字格式 (K/M) */
  NUMBER_FORMAT: /k|m/i,
  /** 日期格式 YYYY-MM-DD */
  DATE_FORMAT: /^\d{4}-\d{2}-\d{2}$/,
} as const

/**
 * 分页和限制常量
 */
export const LIMITS = {
  /** 最大文件名长度 */
  MAX_FILENAME_LENGTH: 120,
  /** 最大标题长度 */
  MAX_TITLE_LENGTH: 200,
  /** 最大摘要长度 */
  MAX_SUMMARY_LENGTH: 1000,
  /** 最大并发文件操作数 */
  MAX_CONCURRENT_FILES: 10,
} as const

/**
 * 国际化相关常量
 */
export const I18N = {
  /** 默认语言 */
  DEFAULT_LANGUAGE: "zh",
  /** 支持的语言列表 */
  SUPPORTED_LANGUAGES: ["zh", "en"] as const,
} as const

/**
 * 命令行相关常量
 */
export const CLI = {
  /** 版本号格式 */
  VERSION_FORMAT: /^\d+\.\d+\.\d+$/,
  /** 帮助命令 */
  HELP_COMMANDS: ["help", "h", "--help", "-h"],
  /** 版本命令 */
  VERSION_COMMANDS: ["version", "-v", "--version"],
} as const

/**
 * 类型定义
 */
export type SupportedLanguage = (typeof I18N.SUPPORTED_LANGUAGES)[number]
export type ErrorCode = keyof typeof ERROR_CODES
