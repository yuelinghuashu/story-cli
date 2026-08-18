/**
 * 共享统计计算
 * 供 CLI `story stats` 与 MCP `stats` 工具复用，保证两端口径完全一致
 * 统一处理：总量汇总 / 系列分组 / 健康度（字数过期）/ 重复短语
 */
import type { Locale } from "../i18n/index.ts"
import { extractRepeatedPhrases } from "../utils/phrase-frequency.ts"
import { formatTotalWordCount } from "../utils/word-count.ts"
import { splitSections } from "./scanner.ts"
import type { Language } from "./types.ts"

/** 参与统计的最小故事数据（CLI 与 MCP 各自适配为这个形状） */
export interface StatsStoryInput {
  /** 故事文件夹名（如 "01-故事A"） */
  folder: string
  /** config.status */
  status: string
  /** config.series（无系列则为 undefined） */
  series?: string
  /** config.wordCount（格式化字符串，如 "约 5 千字"；未写入时为空） */
  configWordCount?: string
  /** 实际字数（数字） */
  rawWordCount: number
  /** 故事语言 */
  lang: Language
  /** 正文全文（用于章节计数 / 重复短语检测） */
  content: string
}

/** 系列统计 */
export interface SeriesStat {
  name: string
  count: number
  completed: number
  totalWords: number
}

/** 健康检查错误码 */
export type HealthCode = "stale-word-count"

/** 健康检查项（结构化：机器可读 code + 人类可读 message） */
export interface HealthItem {
  code: HealthCode
  folder: string
  message: string
  /** 附加结构化信息（如断崖章节标题与字数） */
  detail?: Record<string, unknown>
}

/** 重复短语条目 */
export interface RepeatedPhrase {
  phrase: string
  count: number
}

/** 汇总统计结果 */
export interface StoryStatsResult {
  storyCount: number
  totalWords: number
  totalChapters: number
  completedCount: number
  ongoingCount: number
  standaloneCount: number
  series: SeriesStat[]
  health: HealthItem[]
  /** 全局重复短语（top N，按次数降序） */
  repeated: RepeatedPhrase[]
}

/**
 * 解析格式化字数为数字（供 stale-word-count 检查）
 * 中文格式：约 X 万字 / 约 X 千字 / 约 X 字；英文格式：~XK words / ~X words
 * @param formatted 格式化字数
 * @param lang 语言
 * @returns 数字；无法解析时返回 null
 */
export function extractNumericWordCount(formatted: string, lang: string): number | null {
  const match = formatted.match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const num = Number.parseFloat(match[1])
  if (Number.isNaN(num)) return null

  // 防御性：语言与格式应为互斥（formatWordCount 按语言输出），
  // 显式忽略以下互斥情况：若英文格式中混入「万」或中文格式中混入「K」
  if (lang === "en") {
    // "~5K words" → 5000
    if (/k/i.test(formatted)) return Math.round(num * 1000)
    return Math.round(num)
  }

  // 中文格式
  if (formatted.includes("万字")) return Math.round(num * 10000)
  if (formatted.includes("千字")) return Math.round(num * 1000)
  return Math.round(num)
}

/**
 * 统一统计计算（CLI stats 与 MCP stats 共用）
 * @param stories 参与统计的故事列表
 * @param locale 用于健康检查的人类可读文案
 * @returns 结构化汇总结果
 */
export function computeStoryStats(stories: StatsStoryInput[], locale: Locale): StoryStatsResult {
  const totalWords = stories.reduce((sum, s) => sum + s.rawWordCount, 0)
  const completedCount = stories.filter((s) => s.status === "completed").length
  const ongoingCount = stories.filter((s) => s.status === "ongoing").length
  const totalChapters = stories.reduce((sum, s) => sum + splitSections(s.content).length, 0)

  // 系列分组（保持首次出现顺序，与历史行为一致）
  const seriesMap = new Map<string, { count: number; completed: number; totalWords: number }>()
  let standaloneCount = 0
  for (const story of stories) {
    const seriesName = story.series?.trim()
    if (seriesName) {
      const existing = seriesMap.get(seriesName) ?? { count: 0, completed: 0, totalWords: 0 }
      existing.count++
      if (story.status === "completed") existing.completed++
      existing.totalWords += story.rawWordCount
      seriesMap.set(seriesName, existing)
    } else {
      standaloneCount++
    }
  }
  const series: SeriesStat[] = [...seriesMap.entries()].map(([name, stat]) => ({ name, ...stat }))

  // 健康度检查
  const health: HealthItem[] = []

  for (const story of stories) {
    // 字数过期（config 中声明的 wordCount 与实际差距 >20%）
    if (story.configWordCount) {
      const configNum = extractNumericWordCount(story.configWordCount, story.lang)
      if (configNum !== null && story.rawWordCount > 0) {
        const diffRatio = Math.abs(configNum - story.rawWordCount) / story.rawWordCount
        if (diffRatio > 0.2) {
          health.push({
            code: "stale-word-count",
            folder: story.folder,
            message: locale.statsStaleWordCount(
              story.folder,
              story.configWordCount,
              formatTotalWordCount(story.rawWordCount, story.lang),
            ),
            detail: { configWordCount: configNum, actualWordCount: story.rawWordCount },
          })
        }
      }
    }
  }

  // 全局重复短语（top 10）
  const repeated = extractRepeatedPhrases(
    stories.map((s) => ({ content: s.content, lang: s.lang })),
    10,
  )

  return {
    storyCount: stories.length,
    totalWords,
    totalChapters,
    completedCount,
    ongoingCount,
    standaloneCount,
    series,
    health,
    repeated,
  }
}
