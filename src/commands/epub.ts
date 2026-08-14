import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "../args.ts"
import { loadRepoConfig } from "../core/config.ts"
import { readStoryText, scanStoryFolders, splitContentByChapters } from "../core/scanner.ts"
import { loadStoryConfig } from "../core/story-loader.ts"
import type { EpubChapter, EpubImage, Language, StoryConfig } from "../core/types.ts"
import type { ValidationOverrides } from "../core/validate.ts"
import { generateEpub, mdToHtml, safeImageName } from "../render/epub-generator.ts"
import { detectCliLang, sanitizeFileName } from "../utils/cli-utils.ts"
import { ErrorCode, formatError, StoryError } from "../utils/errors.ts"
import { getLocale } from "../utils/i18n.ts"

/**
 * 加载封面图片（可选）
 * 支持：绝对路径、相对于故事文件夹、相对于项目根目录
 * @param folderPath 故事文件夹路径
 * @param rootDir 项目根目录路径
 * @param coverPath config.json 中的 cover 字段值
 * @returns 封面图片；无封面或加载失败时返回 null
 */
function loadCoverImage(folderPath: string, rootDir: string, coverPath: string): EpubImage | null {
  // 解析路径：绝对路径 → 相对故事文件夹 → 相对项目根目录
  let resolved: string | null = null
  if (path.isAbsolute(coverPath)) {
    resolved = coverPath
  } else {
    const inFolder = path.join(folderPath, coverPath)
    const inRoot = path.join(rootDir, coverPath)
    if (fs.existsSync(inFolder)) {
      resolved = inFolder
    } else if (fs.existsSync(inRoot)) {
      resolved = inRoot
    }
  }

  if (!resolved || !fs.existsSync(resolved)) {
    console.warn(`⚠️ 封面图片不存在: ${coverPath}`)
    return null
  }

  try {
    const data = new Uint8Array(fs.readFileSync(resolved))
    const ext = path.extname(resolved).toLowerCase()
    // 使用 cover 固定文件名（保留扩展名）
    return { name: `cover${ext}`, data }
  } catch (e) {
    console.warn(`⚠️ 读取封面图片失败: ${coverPath} - ${(e as Error).message}`)
    return null
  }
}

/**
 * 从 HTML 中提取所有图片 src 引用
 * @param html 章节 HTML 内容
 * @returns 图片路径列表
 */
function extractImageSrcs(html: string): string[] {
  const matches = html.match(/<img src="([^"]+)" alt="[^"]*"\/?>/g) || []
  return matches
    .map((m) => {
      const srcMatch = m.match(/src="([^"]+)"/)
      return srcMatch ? srcMatch[1] : null
    })
    .filter((s): s is string => !!s)
}

/**
 * 加载并安全命名故事中的图片文件
 * 图片路径支持：绝对路径、相对于故事文件夹、相对于项目根目录
 * @param folderPath 故事文件夹路径
 * @param rootDir 项目根目录路径
 * @param srcs 图片路径列表
 * @param locale 语言文案
 * @returns 图片列表 + 路径映射 + 警告
 */
function loadImages(
  folderPath: string,
  rootDir: string,
  srcs: string[],
  locale: ReturnType<typeof getLocale>,
): {
  images: EpubImage[]
  srcMap: Map<string, string>
  warnings: string[]
} {
  const images: EpubImage[] = []
  const warnings: string[] = []
  const srcMap = new Map<string, string>()
  const seen = new Map<string, string>()

  for (const src of srcs) {
    // 跳过外部 URL 和 data URI
    if (/^https?:\/\//.test(src) || /^data:/.test(src)) {
      srcMap.set(src, src) // 保留原始引用
      continue
    }

    // 解析路径：绝对路径 → 相对故事文件夹 → 相对项目根目录
    let resolved: string | null = null
    if (path.isAbsolute(src)) {
      resolved = src
    } else {
      const inFolder = path.join(folderPath, src)
      const inRoot = path.join(rootDir, src)
      if (fs.existsSync(inFolder)) {
        resolved = inFolder
      } else if (fs.existsSync(inRoot)) {
        resolved = inRoot
      }
    }

    if (!resolved || !fs.existsSync(resolved)) {
      warnings.push(locale.epubImageMissing(src))
      // 不可用图片保留 src 原样（不替换，直接显示）
      srcMap.set(src, src)
      continue
    }

    if (seen.has(resolved)) {
      // 已加载过的图片，复用安全名
      srcMap.set(src, `images/${seen.get(resolved)}`)
      continue
    }

    try {
      const data = new Uint8Array(fs.readFileSync(resolved))
      const safeName = safeImageName(path.basename(resolved), images.length + 1)
      images.push({ name: safeName, data })
      seen.set(resolved, safeName)
      srcMap.set(src, `images/${safeName}`)
    } catch (e) {
      warnings.push(locale.epubImageReadFailed(src, (e as Error).message))
      srcMap.set(src, src)
    }
  }

  return { images, srcMap, warnings }
}

/**
 * 将章节 HTML 中的图片 src 替换为 EPUB 内部路径
 * @param html 章节 HTML
 * @param srcMap 原始路径 → EPUB 内部路径映射
 * @returns 替换后的 HTML
 */
function rewriteImageSrcs(html: string, srcMap: Map<string, string>): string {
  return html.replace(/<img src="([^"]+)" alt="([^"]*)"\/?>/g, (_match, src: string, alt: string) => {
    const newSrc = srcMap.get(src) || src
    return `<img src="${newSrc}" alt="${alt}"/>`
  })
}

/**
 * 确定 EPUB 导出目标
 * @param rootDir 项目根目录
 * @param title 故事标题（可选）
 * @param all 是否导出全部
 * @returns 目标故事文件夹列表
 */
function resolveTargets(
  rootDir: string,
  title: string | undefined,
  all: boolean,
  locale: ReturnType<typeof getLocale>,
): string[] {
  if (all) {
    return scanStoryFolders(rootDir)
  }

  const folders = scanStoryFolders(rootDir)
  const exact = folders.find((f) => f.includes(title ?? ""))
  if (!exact) {
    throw new StoryError(locale.epubNotFound(title ?? ""), ErrorCode.STORY_NOT_FOUND, { title })
  }
  return [exact]
}

/**
 * 读取单个故事的配置 + 正文，供 EPUB 导出使用
 * 使用共享的 loadStoryConfig 工具（错误消息通过 StoryError 抛出）
 * @param folderPath 故事文件夹路径
 * @param folder 故事文件夹名
 * @param overrides 仓库级校验覆盖
 * @returns 配置 + 正文 + 语言
 */
function loadStoryForEpub(
  folderPath: string,
  folder: string,
  overrides: ValidationOverrides,
): { config: StoryConfig; content: string; lang: Language } {
  const { config, lang } = loadStoryConfig(folderPath, folder, overrides)

  const { content } = readStoryText(folderPath)
  if (!content.trim()) {
    throw new StoryError(`empty content: ${folder}`, ErrorCode.EMPTY_CONTENT, { folder })
  }

  return { config, content, lang }
}

/**
 * 从正文生成 EPUB 章节（Markdown → HTML）
 * @param content 正文内容
 * @param config 故事配置
 * @param folder 故事文件夹名
 * @returns 章节列表
 */
function buildChapters(content: string, config: StoryConfig, folder: string): EpubChapter[] {
  const sections = splitContentByChapters(content)
  if (sections.length > 0) {
    return sections.map((section) => ({
      title: section.title,
      data: mdToHtml(section.content),
    }))
  }
  return [{ title: String(config.title || folder), data: mdToHtml(content) }]
}

/**
 * 提取并加载故事图片，替换 HTML 中的 src 为 EPUB 内部路径
 * @param folderPath 故事文件夹路径
 * @param rootDir 项目根目录
 * @param chapters 章节列表
 * @param locale 语言文案
 * @returns 更新后的章节 + 图片列表
 */
function loadStoryImages(
  folderPath: string,
  rootDir: string,
  chapters: EpubChapter[],
  locale: ReturnType<typeof getLocale>,
): { chapters: EpubChapter[]; images: EpubImage[]; warnings: string[] } {
  const allHtml = chapters.map((c) => c.data).join("\n")
  const imageSrcs = extractImageSrcs(allHtml)
  const { images, srcMap, warnings } = loadImages(folderPath, rootDir, imageSrcs, locale)

  if (srcMap.size > 0) {
    return {
      chapters: chapters.map((c) => ({ ...c, data: rewriteImageSrcs(c.data, srcMap) })),
      images,
      warnings,
    }
  }

  return { chapters, images, warnings }
}

/**
 * 生成 EPUB 元数据（许可证文本 + 作者）
 * @param config 故事配置
 * @param lang 语言
 * @returns 元数据对象
 */
function buildEpubMetadata(
  config: StoryConfig,
  lang: Language,
): {
  title: string
  author: string
  description: string
  lang: Language
  license: string
} {
  const license =
    config.type === "original"
      ? lang === "en"
        ? "This work is licensed under CC BY-NC-SA 4.0. You are free to share, non-commercially; derivatives must use the same license."
        : "本作品采用 CC BY-NC-SA 4.0 许可证。你可以署名共享、非商业使用，修改后的作品需沿用相同许可。"
      : lang === "en"
        ? `This is a fan work based on ${config.originalWork || ""} (by ${config.originalAuthor || ""}). Original characters and world rights belong to the original creators. Commercial use is strictly prohibited.`
        : `本作品是基于${config.originalWork || ""}（原作：${config.originalAuthor || ""}）的同人创作。原作角色、世界观等元素的版权归原作者及版权方所有。禁止将本故事用于任何商业用途。`

  return {
    title: String(config.title),
    // 原创故事使用 config.author（若有配置），否则默认 "unknown"
    // 二创故事使用 originalAuthor（原作作者名）
    author: String(config.author || config.originalAuthor || "unknown"),
    description: String(config.summary || ""),
    lang,
    license,
  }
}

/**
 * 导出 epub
 * 拆分职责：
 *  - resolveTargets: 确定导出目标
 *  - loadStoryForEpub: 读取 + 校验故事数据
 *  - buildChapters: Markdown → HTML 章节
 *  - loadStoryImages: 图片处理
 *  - buildEpubMetadata: 元数据生成
 * @param rootDir 项目根目录
 * @param args 命令行参数
 * @returns 退出码（0 成功，1 有失败）
 */
export function exportEpub(rootDir: string, args: string[]): number {
  const { positional, options } = parseArgs(args)
  const title = positional[0]
  const all = !!options.all
  const distDir = path.join(rootDir, "dist", "epub")
  const locale = getLocale(detectCliLang())

  if (!title && !all) {
    throw new StoryError(locale.epubNoArgsError, ErrorCode.INVALID_ARGS)
  }

  console.log(`${locale.epubExporting}\n`)

  const targets = resolveTargets(rootDir, title, all, locale)

  // 仓库级配置只需读取一次（循环外调用，避免重复 I/O）
  const repoConfig = loadRepoConfig(rootDir)
  const validationOverrides: ValidationOverrides = {
    types: repoConfig.types,
    statuses: repoConfig.statuses,
  }

  let success = 0
  let failed = 0

  for (const folder of targets) {
    const folderPath = path.join(rootDir, folder)

    try {
      // 读取 + 校验故事数据
      const { config, content, lang } = loadStoryForEpub(folderPath, folder, validationOverrides)

      // 生成章节（Markdown → HTML）
      let chapters = buildChapters(content, config, folder)

      // 提取并加载图片，替换 HTML 中的 src 为 EPUB 内部路径
      const { chapters: updatedChapters, images, warnings } = loadStoryImages(folderPath, rootDir, chapters, locale)
      chapters = updatedChapters

      for (const w of warnings) {
        console.warn(`  ${w}`)
      }

      // 安全文件名 + 输出路径
      const safeTitle = sanitizeFileName(String(config.title)) || `story-${folder}`
      const outputPath = path.join(distDir, `${safeTitle}.epub`)

      // 生成元数据 + 许可证
      const option = buildEpubMetadata(config, lang)

      // 加载封面图片（可选）
      const coverImage = config.cover ? loadCoverImage(folderPath, rootDir, config.cover) : null

      // 写入 EPUB
      fs.mkdirSync(distDir, { recursive: true })
      const epubData = generateEpub(option, chapters, images, coverImage || undefined)
      fs.writeFileSync(outputPath, epubData)

      const sizeKB = (epubData.length / 1024).toFixed(1)
      const imgInfo = images.length > 0 ? `, ${images.length} images` : ""
      console.log(locale.epubExportSuccess(folder, path.relative(rootDir, outputPath), sizeKB, imgInfo))
      success++
    } catch (e) {
      console.error(formatError(e))
      failed++
    }
  }

  console.log(`\n${locale.epubStats(success, failed)}`)
  console.log(locale.epubOutputDir(path.relative(rootDir, distDir)))

  return failed > 0 ? 1 : 0
}
