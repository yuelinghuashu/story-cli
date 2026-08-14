import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "../args.ts"
import { loadRepoConfigAsync } from "../core/config.ts"
import {
  EXCLUDE_DIRS,
  extractChaptersLocalized,
  readStoryTextAsync,
  resolveRawWordCount,
  resolveWordCount,
  scanStoryFoldersAsync,
} from "../core/scanner.ts"
import type { BuildResult, StoryConfig, StoryData, ValidationIssue } from "../core/types.ts"
import { type ValidationOverrides, validateConfig } from "../core/validate.ts"
import { generateRootReadme, generateStoryReadme } from "../render/readme.ts"
import { formatStatus, formatType, getLocale, resolveLang } from "../utils/i18n.ts"
import { templatesDir } from "../utils/paths.ts"

/** 类型/状态的本地化标签映射 */
type LabelMap = Record<string, Record<string, string>>

/**
 * 检测 CLI 输出语言：根据系统环境变量 LANG 检测，默认中文
 * @returns 语言代码（zh / en）
 */
function detectCliLang(): string {
  const systemLang = process.env.LANG || ""
  return systemLang.toLowerCase().startsWith("en") ? "en" : "zh"
}

/**
 * 异步读取并校验单个故事的 config.json
 * @param folderPath 故事文件夹路径
 * @param folder 故事文件夹名（用于错误提示）
 * @param overrides 仓库级校验覆盖
 * @returns 规范化后的故事配置 + 校验问题
 */
async function loadStoryConfigAsync(
  folderPath: string,
  folder: string,
  overrides: ValidationOverrides,
): Promise<{ config: StoryConfig; issues: ValidationIssue[] }> {
  const configPath = path.join(folderPath, "config.json")

  let rawText: string
  try {
    rawText = await fs.promises.readFile(configPath, "utf-8")
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === "ENOENT") {
      return {
        config: null as unknown as StoryConfig,
        issues: [{ code: "missing", field: "config.json", message: `${folder}: missing config.json` }],
      }
    }
    return {
      config: null as unknown as StoryConfig,
      issues: [
        {
          code: "parse",
          field: "config.json",
          message: `${folder}: config.json read failed - ${(e as Error).message}`,
        },
      ],
    }
  }

  let rawConfig: Record<string, unknown>
  try {
    rawConfig = JSON.parse(rawText) as Record<string, unknown>
  } catch (e) {
    return {
      config: null as unknown as StoryConfig,
      issues: [
        {
          code: "parse",
          field: "config.json",
          message: `${folder}: config.json parse failed - ${(e as Error).message}`,
        },
      ],
    }
  }

  const result = validateConfig(rawConfig, folder, overrides)
  return { config: result.normalized, issues: result.issues }
}

/**
 * 异步读取故事正文（text.md 或合并 chapter-*.md）
 * 若非校验模式下由章节合并时，自动写入 text.md
 * @param folderPath 故事文件夹路径
 * @param validateOnly 是否为纯校验模式（不写回文件）
 * @param locale 语言文案
 * @returns 正文内容 + 警告
 */
async function loadStoryContentAsync(
  folderPath: string,
  validateOnly: boolean,
  locale: ReturnType<typeof getLocale>,
): Promise<{ content: string; warnings: string[] }> {
  const warnings: string[] = []
  const { content, merged } = await readStoryTextAsync(folderPath)

  if (merged) {
    warnings.push(locale.mergedWarning(path.basename(folderPath)))
    // 仅在非校验模式下自动生成 text.md
    if (!validateOnly) {
      await fs.promises.writeFile(path.join(folderPath, "text.md"), content, "utf-8")
      console.log(locale.generatedText(path.basename(folderPath)))
    }
  }

  return { content, warnings }
}

/**
 * 组装单个故事的 StoryData 对象
 * @param folder 故事文件夹名
 * @param config 规范化配置
 * @param content 正文内容
 * @returns 组装完成的故事数据
 */
function buildStoryData(
  folder: string,
  config: StoryConfig,
  content: string,
  typeLabels?: LabelMap,
  statusLabels?: LabelMap,
): StoryData {
  const lang = resolveLang(config)
  const wordCount = resolveWordCount(config, content)

  return {
    folder,
    config,
    content,
    lang,
    wordCount,
    rawWordCount: resolveRawWordCount(content, lang),
    chapters: extractChaptersLocalized(content, lang),
    typeDisplay: formatType(config.type, lang, typeLabels),
    statusDisplay: formatStatus(config.status, lang, statusLabels),
  }
}

/**
 * 异步扫描并加载所有故事的配置与正文（并行读取）
 * @param rootDir 项目根目录
 * @param saveCounts 是否将自动计算的字数写回 config.json
 * @param cliLang CLI 输出语言
 * @param validateOnly 是否为纯校验模式（不写回文件）
 * @returns 故事数据 + 校验问题 + 警告
 */
async function loadStories(
  rootDir: string,
  saveCounts = false,
  cliLang = "zh",
  validateOnly = false,
): Promise<BuildResult> {
  const locale = getLocale(cliLang)
  const stories: StoryData[] = []
  const issues: ValidationIssue[] = []
  const warnings: string[] = []

  // 读取仓库级自定义枚举与本地化标签
  const repoConfig = await loadRepoConfigAsync(rootDir)
  const validationOverrides: ValidationOverrides = {
    types: repoConfig.types,
    statuses: repoConfig.statuses,
  }
  const typeLabels = repoConfig.typeLabels
  const statusLabels = repoConfig.statusLabels

  // 检测序号重复（基于已扫描的文件夹列表，避免重复 IO）
  const folders = await scanStoryFoldersAsync(rootDir)
  const numberSeen = new Map<string, string>()
  const duplicates = new Set<string>()
  for (const folder of folders) {
    const num = folder.split("-")[0]
    const existing = numberSeen.get(num)
    if (existing !== undefined) {
      duplicates.add(num)
    } else {
      numberSeen.set(num, folder)
    }
  }
  for (const num of [...duplicates].sort()) {
    warnings.push(locale.duplicateNumberWarning(num))
  }

  // 并行加载所有故事（每个故事内部顺序读取 config + 正文）
  const loadResults = await Promise.all(
    folders.map(async (folder) => {
      const folderPath = path.join(rootDir, folder)

      // 读取 + 校验 config.json
      const { config, issues: configIssues } = await loadStoryConfigAsync(folderPath, folder, validationOverrides)
      if (configIssues.length > 0) {
        return { story: null as unknown as StoryData, issues: configIssues, contentWarnings: [] as string[] }
      }

      // 读取正文
      const { content, warnings: contentWarnings } = await loadStoryContentAsync(folderPath, validateOnly, locale)

      // 组装故事数据
      const story = buildStoryData(folder, config, content, typeLabels, statusLabels)

      // 字数提示（未在 config 中声明 wordCount 时）
      if (!config.wordCount) {
        console.log(locale.autoWordCount(folder, story.wordCount, saveCounts))
      }

      // 仅在显式开启 saveCounts 时才写回 config.json
      if (saveCounts && story.wordCount !== config.wordCount) {
        await fs.promises.writeFile(
          path.join(folderPath, "config.json"),
          `${JSON.stringify({ ...config, wordCount: story.wordCount }, null, 2)}\n`,
          "utf-8",
        )
      }

      return { story, issues: [] as ValidationIssue[], contentWarnings }
    }),
  )

  for (const result of loadResults) {
    issues.push(...result.issues)
    warnings.push(...result.contentWarnings)
    if (result.story) stories.push(result.story)
  }

  return { stories, issues, warnings }
}

/**
 * 生成所有故事 README 与根 README
 * @param rootDir 项目根目录
 * @param stories 故事列表
 * @param cliLang CLI 输出语言
 * @returns 生成的故事 README 数量
 */
function generateReadmes(rootDir: string, stories: StoryData[], cliLang = "zh"): number {
  const locale = getLocale(cliLang)
  console.log(`\n${locale.generatingReadmes}`)
  const templatePath = path.join(templatesDir, "story-template.md")
  let readmeCount = 0

  for (const story of stories) {
    const { folder, config } = story
    const folderPath = path.join(rootDir, folder)
    const lang = story.lang
    const storyLocale = getLocale(lang)

    const renderData: Record<string, unknown> = {
      ...config,
      chapters: story.chapters,
      lang,
      typeDisplay: story.typeDisplay,
      statusDisplay: story.statusDisplay,
      backToStoryList: storyLocale.backToStoryList,
      basicInfoTitle: storyLocale.basicInfoTitle,
      typeLabel: storyLocale.typeLabel,
      wordCountLabel: storyLocale.wordCountLabel,
      statusLabel: storyLocale.statusLabel,
      createDateLabel: storyLocale.createDateLabel,
      summaryTitle: storyLocale.summaryTitle,
      readingGuideTitle: storyLocale.readingGuideTitle,
      textFileLabel: storyLocale.textFileLabel,
      chaptersTitle: storyLocale.chaptersTitle,
      licenseTitle: storyLocale.licenseTitle,
      licenseText:
        config.type === "original"
          ? storyLocale.licenseOriginalText
          : storyLocale.licenseFanficText(config.originalWork || "", config.originalAuthor || ""),
      licenseNote: config.type === "fanfic" ? storyLocale.licenseFanficNote : "",
      autoGenerated: storyLocale.autoGenerated,
    }

    generateStoryReadme(folderPath, templatePath, renderData)
    console.log(locale.storyReadmeDone(folder))
    readmeCount++
  }

  generateRootReadme(
    rootDir,
    stories.map((s) => ({
      folder: s.folder,
      title: s.config.title,
      typeDisplay: s.typeDisplay,
      wordCount: s.wordCount,
      statusDisplay: s.statusDisplay,
      summary: s.config.summary || "",
      rawWordCount: s.rawWordCount,
      lang: s.lang,
    })),
  )
  console.log(locale.generatingRoot)

  return readmeCount
}

/**
 * 运行 build 命令
 * @param rootDir 项目根目录
 * @param args 命令行参数
 */
export async function runBuild(rootDir: string, args: string[]): Promise<number> {
  const { options } = parseArgs(args)
  const validateOnly = !!options["validate-only"]
  const saveCounts = !!options["save-counts"]
  const watch = !!options.watch
  // CLI 输出语言：根据系统环境变量 LANG 检测，默认中文
  const cliLang = detectCliLang()
  const locale = getLocale(cliLang)

  if (watch) {
    runWatchMode(rootDir, { validateOnly, saveCounts, cliLang })
    return 0
  }

  console.log(locale.scanning, "\n")

  const { stories, issues, warnings } = await loadStories(rootDir, saveCounts, cliLang, validateOnly)

  for (const w of warnings) {
    console.log(w)
  }

  if (issues.length > 0) {
    console.error(`\n${locale.buildFail}`)
    for (const issue of issues) {
      console.error(`  ❌ ${issue.message}`)
    }
    return 1
  }

  if (validateOnly) {
    console.log(`\n${locale.validateOnly(stories.length)}`)
    return 0
  }

  generateReadmes(rootDir, stories, cliLang)
  console.log(`\n${locale.buildSuccess(stories.length)}`)
  return 0
}

/**
 * Watch 模式：监听仓库变更并自动重建
 * @param rootDir 项目根目录
 * @param options watch 模式选项
 */
function runWatchMode(rootDir: string, options: { validateOnly: boolean; saveCounts: boolean; cliLang: string }): void {
  const { validateOnly, saveCounts, cliLang } = options
  const locale = getLocale(cliLang)
  console.log(`👀 ${locale.watchStart}`)

  const debounceMs = 300
  let timer: ReturnType<typeof setTimeout> | null = null
  let rebuilding = false

  const doBuild = async (trigger: string) => {
    if (rebuilding) return
    rebuilding = true
    console.log(`\n🔨 ${locale.watchRebuild(trigger)}`)

    try {
      const { stories, issues, warnings } = await loadStories(rootDir, saveCounts, cliLang, validateOnly)

      for (const w of warnings) {
        console.log(w)
      }

      if (issues.length > 0) {
        console.error(`\n${locale.buildFail}`)
        for (const issue of issues) {
          console.error(`  ❌ ${issue.message}`)
        }
      } else if (!validateOnly) {
        generateReadmes(rootDir, stories, cliLang)
        console.log(`${locale.watchDone(stories.length)}`)
      } else {
        console.log(`${locale.validateOnly(stories.length)}`)
      }
    } finally {
      rebuilding = false
    }
  }

  const debouncedBuild = (trigger: string) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      void doBuild(trigger)
      timer = null
    }, debounceMs)
  }

  // 监听根目录下的直接子目录和文件（不递归，避免 node_modules 等噪音）
  const watchers: fs.FSWatcher[] = []
  const watched = new Set<string>()

  const watchDir = (dir: string) => {
    if (watched.has(dir)) return
    watched.add(dir)

    try {
      const watcher = fs.watch(dir, (_event, filename) => {
        if (!filename) return

        // 忽略常见噪音
        if (filename.toString().startsWith(".")) return
        if (filename.toString() === "node_modules") return

        debouncedBuild(filename.toString())
      })
      watchers.push(watcher)

      // 递归子目录（但排除基础设施目录）
      if (fs.existsSync(dir)) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory() && !EXCLUDE_DIRS.has(entry.name)) {
            watchDir(path.join(dir, entry.name))
          }
        }
      }
    } catch {
      // 目录可能被删除，忽略
    }
  }

  watchDir(rootDir)

  console.log(locale.watchHint)

  // 初始构建
  void doBuild("initial")

  // Ctrl+C 清理
  process.on("SIGINT", () => {
    for (const w of watchers) w.close()
    console.log(`\n👋 ${locale.watchExit}`)
    process.exit(0)
  })
}
