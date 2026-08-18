import { execFileSync } from "node:child_process"
import path from "node:path"
import { parseArgs } from "../args.ts"
import { loadRepoConfig } from "../core/config.ts"
import { readStoryText, scanStoryFolders, splitSections } from "../core/scanner.ts"
import { computeStoryStats, type StatsStoryInput } from "../core/stats-shared.ts"
import { loadStoryConfig } from "../core/story-loader.ts"
import type { ChapterInfo, Language } from "../core/types.ts"
import type { ValidationOverrides } from "../core/validate.ts"
import { getLocale } from "../i18n/index.ts"
import { detectCliLang } from "../utils/cli-utils.ts"
import { formatError } from "../utils/errors.ts"
import { countWords, formatTotalWordCount, formatWordCount } from "../utils/word-count.ts"

/**
 * 单个故事的统计明细（供 CLI 的 per-story JSON 输出与人类展示使用）
 */
interface StoryDetail {
  folder: string
  title: string
  lang: Language
  rawWordCount: number
  status: string
  series?: string
  seriesOrder?: number
  summary?: string
  configWordCount?: string
  chapterCount: number
  /** 章节明细（标题 + 格式化字数） */
  chapters: ChapterInfo[]
  /** 每章原始字数（与 chapters 对齐，供 make analyze 数值分析） */
  chapterRawCounts: number[]
  /** 段落数（按空行分割） */
  paragraphCount: number
  /** 对话数（中文引号 / 英文引号内的对话片段） */
  dialogueCount: number
  /** 平均章节字数（节奏指标） */
  avgChapterLen: number
  /** 章节字数标准差（节奏波动，越大越不均衡） */
  chapterLenStdDev: number
  /** 对话字数占比（0~1，对话/叙述结构指标） */
  dialogueRatio: number
}

/**
 * 从 git log 获取各月份新增字数
 * 通过 `git log --numstat --format=%ad --date=short` 解析
 * 仅统计故事文件夹内的文件（路径以 NN- 前缀开头），排除 dist/ 等非正文改动
 * 无 git 仓库或 git 不可用时返回空对象
 */
function getGitMonthStats(rootDir: string): Map<string, number> {
  const monthStats = new Map<string, number>()
  try {
    // 获取最近 2 个月的提交统计（新增行数 = 写作字数近似）
    const output = execFileSync(
      "git",
      ["log", "--numstat", "--format=%ad", "--date=short", "--since=2 months ago", "--"],
      { cwd: rootDir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"], timeout: 1000 },
    ) as string

    let currentMonth = ""
    for (const line of output.split("\n")) {
      // 日期行（格式 YYYY-MM-DD）
      if (/^\d{4}-\d{2}-\d{2}/.test(line)) {
        currentMonth = line.slice(0, 7) // YYYY-MM
        continue
      }
      // numstat 格式：added  deleted  file
      const match = line.match(/^(\d+)\s+(\d+)\s+(.+)$/)
      if (match && currentMonth) {
        const filePath = match[3]
        // 只统计故事文件夹内的文件（NN- 前缀），排除 README/dist/ 等非正文文件
        if (!/^\d{2,}-/.test(filePath)) continue
        const added = Number.parseInt(match[1], 10)
        if (!Number.isNaN(added)) {
          monthStats.set(currentMonth, (monthStats.get(currentMonth) ?? 0) + added)
        }
      }
    }
  } catch {
    // git 不可用或非 git 仓库时静默返回空
  }
  return monthStats
}

/**
 * 获取本月和上月的月份键（YYYY-MM 格式）
 */
function getMonthKeys(): { thisMonth: string; lastMonth: string } {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  // 上个月（处理 1 月 → 去年 12 月）
  const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, "0")}`
  return { thisMonth, lastMonth }
}

/**
 * 检查目录是否在 Git 仓库中
 * 使用 `git rev-parse --is-inside-work-tree` 独立检查，
 * 不依赖提交历史（有 Git 仓库但最近无提交时也能正确识别）
 * @param rootDir 项目根目录
 * @returns 是否在 Git 仓库中
 */
function isGitRepo(rootDir: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: rootDir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    })
    return true
  } catch {
    // git 不可用或非 git 仓库时返回 false
    return false
  }
}

/**
 * 执行 story stats 命令
 * 输出创作数据统计（故事数、字数、系列进度、活跃度、健康度）
 * 支持 --json 输出结构化数据
 * 汇总计算（总量/系列/健康度/重复短语）由 computeStoryStats 统一提供，与 MCP stats 口径一致
 *
 * @param rootDir 项目根目录
 * @param args 命令行参数（--json 可选）
 * @returns 退出码（0 成功，1 失败）
 */
export function runStats(rootDir: string, args: string[]): number {
  const { options } = parseArgs(args)
  const asJson = !!options.json
  const cliLang = detectCliLang()
  const locale = getLocale(cliLang)

  if (!asJson) {
    console.log(locale.statsScanning)
  }

  // 读取仓库级配置
  const repoConfig = loadRepoConfig(rootDir)
  const validationOverrides: ValidationOverrides = {
    types: repoConfig.types,
    statuses: repoConfig.statuses,
  }

  // 扫描并加载所有故事
  const folders = scanStoryFolders(rootDir)
  const details: StoryDetail[] = []
  const inputs: StatsStoryInput[] = []
  // 收集有问题的故事（JSON 模式随结果输出，避免管道消费方拿到不完整数据而不自知）
  const errors: Array<{ folder: string; message: string }> = []

  for (const folder of folders) {
    const folderPath = path.join(rootDir, folder)
    try {
      const { config, lang } = loadStoryConfig(folderPath, folder, validationOverrides)
      const { content } = readStoryText(folderPath)
      if (!content.trim()) continue

      const rawWordCount = countWords(content, lang)
      // 章节切分一次，逐章字数只统计一遍，同时产出格式化字数（展示）与原始字数（数值分析）
      const sections = splitSections(content)
      const chapterRawCounts: number[] = sections.map((s) => countWords(s.rawContent, lang))
      const chapters: ChapterInfo[] = sections.map((s, i) => ({
        title: s.title,
        wordCount: formatWordCount(chapterRawCounts[i] ?? 0, lang),
      }))

      details.push({
        folder,
        title: config.title,
        lang,
        rawWordCount,
        status: config.status,
        series: config.series,
        seriesOrder: config.seriesOrder,
        summary: config.summary,
        configWordCount: config.wordCount,
        chapterCount: chapters.length,
        chapters,
        chapterRawCounts,
        paragraphCount: countParagraphs(content),
        dialogueCount: countDialogues(content),
        avgChapterLen: avgChapterLength(chapterRawCounts),
        chapterLenStdDev: chapterLengthStdDev(chapterRawCounts),
        dialogueRatio: dialogueRatio(content, lang, rawWordCount),
      })
      inputs.push({
        folder,
        status: config.status,
        series: config.series,
        configWordCount: config.wordCount,
        rawWordCount,
        lang,
        content,
      })
    } catch (e) {
      // 跳过有问题的故事（与 build 行为一致），但错误始终记录（JSON 模式随结果输出）
      const message = formatError(e)
      errors.push({ folder, message })
      if (!asJson) {
        console.error(message)
      }
    }
  }

  // 统一汇总计算（CLI 与 MCP 共用同一实现）
  const aggregate = computeStoryStats(inputs, locale)

  // 写作活跃度（git 统计）
  // 先独立检查是否为 Git 仓库，再获取提交统计数据
  const isRepo = isGitRepo(rootDir)
  const { thisMonth, lastMonth } = getMonthKeys()
  const monthStats = getGitMonthStats(rootDir)
  const thisMonthWords = monthStats.get(thisMonth) ?? 0
  const lastMonthWords = monthStats.get(lastMonth) ?? 0

  // JSON 输出
  if (asJson) {
    const result = {
      storyCount: aggregate.storyCount,
      completedCount: aggregate.completedCount,
      ongoingCount: aggregate.ongoingCount,
      totalWords: aggregate.totalWords,
      totalChapters: aggregate.totalChapters,
      standaloneCount: aggregate.standaloneCount,
      series: aggregate.series,
      health: {
        warnings: aggregate.health.length,
        items: aggregate.health,
      },
      activity: isRepo ? { thisMonth: thisMonthWords, lastMonth: lastMonthWords } : null,
      stories: details.map((s) => ({
        folder: s.folder,
        title: s.title,
        lang: s.lang,
        wordCount: s.rawWordCount,
        status: s.status,
        series: s.series,
        seriesOrder: s.seriesOrder,
        chapterCount: s.chapterCount,
        // 章节级明细（为 make analyze 提供原料：格式化 + 原始字数）
        chapters: s.chapters.map((c, i) => ({
          title: c.title,
          wordCount: c.wordCount,
          rawWordCount: s.chapterRawCounts[i] ?? 0,
        })),
        // 结构与节奏指标
        paragraphs: s.paragraphCount,
        dialogues: s.dialogueCount,
        // 创作健康看板（供 AI 审视创作节奏/结构）
        avgChapterLen: s.avgChapterLen,
        chapterLenStdDev: s.chapterLenStdDev,
        dialogueRatio: s.dialogueRatio,
      })),
      // 分析原料：全局重复短语（供 make analyze / 人工检查）
      analysis: {
        repeated: aggregate.repeated,
      },
      // 有问题的故事（管道消费方不应静默拿到不完整数据）
      errors,
    }
    console.log(JSON.stringify(result, null, 2))
    return 0
  }

  // 人类可读输出
  const langForFormat = (details.length > 0 && details.every((s) => s.lang === "en") ? "en" : "zh") as "zh" | "en"
  console.log("")
  console.log(locale.statsStoryCount(aggregate.storyCount, aggregate.completedCount, aggregate.ongoingCount))
  console.log(
    locale.statsTotalWords(formatTotalWordCount(aggregate.totalWords, langForFormat), aggregate.totalChapters),
  )

  // 系列
  for (const series of aggregate.series) {
    const completion =
      series.completed === series.count ? "100%" : `${Math.round((series.completed / series.count) * 100)}%`
    console.log(locale.statsSeries(series.name, series.count, completion))
  }
  if (aggregate.standaloneCount > 0) {
    console.log(locale.statsStandalone(aggregate.standaloneCount))
  }

  // 写作活跃度（是 Git 仓库但最近无提交时显示 0 字，而不是误报非 Git）
  if (isRepo) {
    console.log(
      locale.statsActivity(
        formatTotalWordCount(thisMonthWords, langForFormat),
        formatTotalWordCount(lastMonthWords, langForFormat),
      ),
    )
  } else {
    console.log(locale.statsNoGit)
  }

  // 健康度
  if (aggregate.health.length > 0) {
    console.log(locale.statsHealthTitle(aggregate.health.length))
    for (const warning of aggregate.health) {
      console.log(warning.message)
    }
  } else {
    console.log(locale.statsHealthy)
  }

  return 0
}

/**
 * 统计段落数（按空行分割的非空块）
 * @param content 正文内容
 * @returns 段落数
 */
export function countParagraphs(content: string): number {
  if (!content.trim()) return 0
  return content.split(/\n\s*\n/).filter((block) => block.trim().length > 0).length
}

/**
 * 统计对话片段数（中文「」/“” 或英文 "..." 引号内的内容）
 * 处理嵌套引号：外层引号内的内层引号不重复计数
 * @param content 正文内容
 * @returns 对话片段数
 */
export function countDialogues(content: string): number {
  if (!content) return 0

  // 中文引号「」/“” 或 弯引号“”
  const zhMatches = content.match(/[「“][^」”]*[」”]/g) ?? []
  // 英文双引号 "..."：先剥离中文引号区域再匹配，
  // 避免嵌套在中文引号内的英文引号被重复计数（与注释声称的行为一致）
  const withoutZh = content.replace(/[「“][^」”]*[」”]/g, "")
  const enMatches = withoutZh.match(/"[^"\n]*"/g) ?? []
  return zhMatches.length + enMatches.length
}

/**
 * 计算章节平均字数（节奏指标）
 * @param rawCounts 每章原始字数数组
 * @returns 平均值；空数组时返回 0
 */
export function avgChapterLength(rawCounts: number[]): number {
  if (rawCounts.length === 0) return 0
  const total = rawCounts.reduce((sum, n) => sum + n, 0)
  return Math.round(total / rawCounts.length)
}

/**
 * 计算章节字数标准差（节奏波动指标）
 * 衡量各章节字数偏离平均值的程度，越大说明节奏越不均衡
 * @param rawCounts 每章原始字数数组
 * @returns 标准差（四舍五入）；少于 2 章时返回 0（无意义）
 */
export function chapterLengthStdDev(rawCounts: number[]): number {
  if (rawCounts.length < 2) return 0
  const mean = rawCounts.reduce((sum, n) => sum + n, 0) / rawCounts.length
  const variance = rawCounts.reduce((sum, n) => sum + (n - mean) ** 2, 0) / rawCounts.length
  return Math.round(Math.sqrt(variance))
}

/**
 * 计算对话字数占比（对话/叙述结构指标）
 * 提取中文「」/“”与英文 "..." 引号内的字符数，除以按故事语言统计的总字数
 * @param content 正文内容
 * @param lang 故事语言（zh / en）
 * @param totalWords 已算好的总字数（可选；传入可避免对同一文本重复扫描）
 * @returns 对话字数占比（0~1，保留 2 位小数）；内容为空时返回 0
 */
export function dialogueRatio(content: string, lang: Language, totalWords?: number): number {
  if (!content.trim()) return 0
  const dialogues = content.match(/[「“][^」”]*[」”]|"[^"\n]*"/g) ?? []
  const dialogueChars = dialogues.reduce((sum, d) => sum + countWords(d, lang), 0)
  const total = totalWords ?? countWords(content, lang)
  if (total === 0) return 0
  return Number((dialogueChars / total).toFixed(2))
}
