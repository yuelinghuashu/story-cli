import { execFileSync } from "node:child_process"
import path from "node:path"
import { parseArgs } from "../args.ts"
import { loadRepoConfig } from "../core/config.ts"
import { extractChaptersLocalized, readStoryText, resolveRawWordCount, scanStoryFolders } from "../core/scanner.ts"
import { loadStoryConfig } from "../core/story-loader.ts"
import type { ChapterInfo } from "../core/types.ts"
import type { ValidationOverrides } from "../core/validate.ts"
import { getLocale } from "../i18n/index.ts"
import { detectCliLang } from "../utils/cli-utils.ts"
import { formatError } from "../utils/errors.ts"
import { formatTotalWordCount } from "../utils/word-count.ts"

/**
 * 故事统计结果结构
 */
interface StoryStats {
  folder: string
  title: string
  lang: string
  rawWordCount: number
  status: string
  series?: string
  seriesOrder?: number
  summary?: string
  configWordCount?: string
  chapterCount: number
  /** 章节明细（标题 + 字数） */
  chapters: ChapterInfo[]
  /** 段落数（按空行分割） */
  paragraphCount: number
  /** 对话数（中文引号 / 英文引号内的对话片段） */
  dialogueCount: number
}

/**
 * 从 git log 获取各月份新增字数
 * 通过 `git log --numstat --format=%ad --date=short` 解析
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
  const stories: StoryStats[] = []

  for (const folder of folders) {
    const folderPath = path.join(rootDir, folder)
    try {
      const { config, lang } = loadStoryConfig(folderPath, folder, validationOverrides)
      const { content } = readStoryText(folderPath)
      if (!content.trim()) continue

      const rawWordCount = resolveRawWordCount(content, lang)
      const chapters = extractChaptersLocalized(content, lang)

      stories.push({
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
        paragraphCount: countParagraphs(content),
        dialogueCount: countDialogues(content),
      })
    } catch (e) {
      // 跳过有问题的故事（与 build 行为一致）
      if (!asJson) {
        console.error(formatError(e))
      }
    }
  }

  // 汇总统计
  const totalWords = stories.reduce((sum, s) => sum + s.rawWordCount, 0)
  const completedCount = stories.filter((s) => s.status === "completed").length
  const ongoingCount = stories.filter((s) => s.status === "ongoing").length
  const totalChapters = stories.reduce((sum, s) => sum + s.chapterCount, 0)

  // 系列分组统计
  const seriesMap = new Map<string, StoryStats[]>()
  let standaloneCount = 0
  for (const story of stories) {
    const seriesName = story.series?.trim()
    if (seriesName) {
      if (!seriesMap.has(seriesName)) seriesMap.set(seriesName, [])
      seriesMap.get(seriesName)?.push(story)
    } else {
      standaloneCount++
    }
  }

  // 健康度检查
  const healthWarnings: string[] = []
  for (const story of stories) {
    // 缺少 summary
    if (!story.summary || story.summary.trim() === "") {
      healthWarnings.push(locale.statsMissingSummary(story.folder))
    }
    // 字数过期（config 中声明的 wordCount 与实际差距 >20%）
    if (story.configWordCount) {
      const configNum = extractNumericWordCount(story.configWordCount, story.lang)
      if (configNum !== null && story.rawWordCount > 0) {
        const diffRatio = Math.abs(configNum - story.rawWordCount) / story.rawWordCount
        if (diffRatio > 0.2) {
          healthWarnings.push(
            locale.statsStaleWordCount(
              story.folder,
              story.configWordCount,
              formatTotalWordCount(story.rawWordCount, story.lang as "zh" | "en"),
            ),
          )
        }
      }
    }
  }

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
      storyCount: stories.length,
      completedCount,
      ongoingCount,
      totalWords,
      totalChapters,
      standaloneCount,
      series: [...seriesMap.entries()].map(([name, items]) => ({
        name,
        count: items.length,
        completed: items.filter((s) => s.status === "completed").length,
        totalWords: items.reduce((sum, s) => sum + s.rawWordCount, 0),
      })),
      health: {
        warnings: healthWarnings.length,
        items: healthWarnings,
      },
      activity: isRepo ? { thisMonth: thisMonthWords, lastMonth: lastMonthWords } : null,
      stories: stories.map((s) => ({
        folder: s.folder,
        title: s.title,
        lang: s.lang,
        wordCount: s.rawWordCount,
        status: s.status,
        series: s.series,
        seriesOrder: s.seriesOrder,
        chapterCount: s.chapterCount,
        // 章节级明细（为 make analyze 提供原料）
        chapters: s.chapters.map((c) => ({
          title: c.title,
          wordCount: c.wordCount,
        })),
        // 结构与节奏指标
        paragraphs: s.paragraphCount,
        dialogues: s.dialogueCount,
      })),
    }
    console.log(JSON.stringify(result, null, 2))
    return 0
  }

  // 人类可读输出
  const langForFormat = (stories.length > 0 && stories.every((s) => s.lang === "en") ? "en" : "zh") as "zh" | "en"
  console.log("")
  console.log(locale.statsStoryCount(stories.length, completedCount, ongoingCount))
  console.log(locale.statsTotalWords(formatTotalWordCount(totalWords, langForFormat), totalChapters))

  // 系列
  for (const [name, items] of seriesMap) {
    const seriesCompleted = items.filter((s) => s.status === "completed").length
    const completion =
      seriesCompleted === items.length ? "100%" : `${Math.round((seriesCompleted / items.length) * 100)}%`
    console.log(locale.statsSeries(name, items.length, completion))
  }
  if (standaloneCount > 0) {
    console.log(locale.statsStandalone(standaloneCount))
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
  if (healthWarnings.length > 0) {
    console.log(locale.statsHealthTitle(healthWarnings.length))
    for (const warning of healthWarnings) {
      console.log(warning)
    }
  } else {
    console.log(locale.statsHealthy)
  }

  return 0
}

/**
 * 从格式化字数中提取数字（如 "约 3 千字" → 3000、"~5K words" → 5000）
 * @param formatted 格式化字数
 * @param lang 语言
 * @returns 数字或 null（无法解析时）
 */
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
 * @param content 正文内容
 * @returns 对话片段数
 */
export function countDialogues(content: string): number {
  if (!content) return 0
  // 中文引号「」/「」 或 弯引号“”
  const zhMatches = content.match(/[「“][^」”]*[」”]/g) ?? []
  // 英文双引号 "..."
  const enMatches = content.match(/"[^"]*"/g) ?? []
  return zhMatches.length + enMatches.length
}

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
