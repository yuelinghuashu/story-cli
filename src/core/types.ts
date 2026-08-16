/**
 * 全局类型定义
 * TypeScript 接口，替代原 JSDoc typedef
 */

/** 故事类型（内部统一英文代码） */
export type StoryType = "original" | "fanfic"

/** 故事状态（内部统一英文代码） */
export type StoryStatus = "completed" | "ongoing"

/** 语言代码 */
export type Language = "zh" | "en"

/**
 * 故事配置对象（来自 config.json）
 * type / status 使用 string 而非联合类型，允许仓库级自定义枚举值
 */
export interface StoryConfig {
  title: string
  type: string
  status: string
  isMultiChapter?: boolean
  language?: Language
  summary: string
  /** 创建日期（YYYY-MM-DD） */
  created: string
  /** 作者名称（可选，原创故事使用） */
  author?: string
  /** 原作名称（fanfic 必填） */
  originalWork?: string
  /** 原作者（fanfic 必填） */
  originalAuthor?: string
  /** 字数描述（build 时自动写入） */
  wordCount?: string
  /** 封面图片路径（可选，EPUB 导出时使用） */
  cover?: string
  /** 系列名称（可选，有值则归入对应系列分组） */
  series?: string
  /** 系列内排序键（可选，支持整数或小数，缺失时回退文件夹序号） */
  seriesOrder?: number
  /** 卷/册名称（可选，仅用于展示） */
  volume?: string
}

/**
 * 章节信息（标题 + 格式化字数）
 */
export interface ChapterInfo {
  title: string
  /** 格式化字数（如 "约 3 千字"） */
  wordCount: string
}

/**
 * 章节内容（标题 + 原始正文内容）
 */
export interface ChapterSection {
  title: string
  content: string
}

/**
 * 完整的故事数据（loadStories 返回的单条记录）
 */
export interface StoryData {
  /** 故事文件夹名（如 "01-故事名"） */
  folder: string
  /** 规范化后的故事配置 */
  config: StoryConfig
  /** 故事正文内容（text.md 或合并章节） */
  content: string
  /** 故事语言 */
  lang: Language
  /** 格式化的字数（如 "约 3 千字"） */
  wordCount: string
  /** 原始字数（数字） */
  rawWordCount: number
  /** 章节列表 */
  chapters: ChapterInfo[]
  /** 类型显示文本（本地化） */
  typeDisplay: string
  /** 状态显示文本（本地化） */
  statusDisplay: string
}

/**
 * 故事汇总信息（根 README 展示用）
 */
export interface StorySummary {
  folder: string
  title: string
  typeDisplay: string
  wordCount: string
  statusDisplay: string
  summary: string
  rawWordCount: number
  lang: Language
  /** 系列名称（有值则归入对应系列分组） */
  series?: string
  /** 系列内排序键（支持整数或小数） */
  seriesOrder?: number
  /** 卷/册名称（仅用于展示） */
  volume?: string
}

/**
 * 构建结果（loadStories 返回值）
 */
export interface BuildResult {
  /** 所有有效故事数据 */
  stories: StoryData[]
  /** 校验问题列表（结构化错误） */
  issues: ValidationIssue[]
  /** 警告信息列表 */
  warnings: string[]
}

/**
 * 单个故事的加载结果（loadStories 内部使用）
 * 成功时 story 有值、issues 为空；失败时 story 为 null、issues 有值
 * 使用判别联合而非断言，避免 null as unknown as StoryData 这类不安全写法
 */
export type StoryLoadResult =
  | { story: StoryData; issues: never[]; contentWarnings: string[] }
  | { story: null; issues: ValidationIssue[]; contentWarnings: never[] }

/**
 * 配置校验结果
 */
export interface ValidationResult {
  valid: boolean
  /** 校验问题列表（结构化错误） */
  issues: ValidationIssue[]
  /** 规范化后的配置 */
  normalized: StoryConfig
}

/**
 * EPUB 章节参数
 */
export interface EpubChapter {
  title: string
  /** 章节 HTML 内容 */
  data: string
}

/**
 * EPUB 图片参数
 */
export interface EpubImage {
  /** EPUB 内部安全文件名（如 img1.png） */
  name: string
  /** 图片二进制数据 */
  data: Uint8Array
}

/**
 * CLI 参数解析结果
 */
export interface ParsedArgs {
  /** 位置参数列表 */
  positional: string[]
  /** 选项键值对 */
  options: Record<string, string | boolean>
}

/**
 * 校验问题（结构化错误）
 */
export interface ValidationIssue {
  /** 错误类型："missing" | "type" | "enum" | "pattern" | "conditional" */
  code: string
  /** 字段名 */
  field: string
  /** 可读消息（已本地化） */
  message: string
  /** 当前值（便于调试） */
  value?: unknown
}
