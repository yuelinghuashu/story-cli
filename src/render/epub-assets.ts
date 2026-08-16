/**
 * EPUB 资源加载工具
 * 从 epub.ts 中抽取的图片/封面加载逻辑
 */
import fs from "node:fs"
import path from "node:path"
import type { EpubImage } from "../core/types.ts"
import type { Locale } from "../i18n/index.ts"
import { isSvgSafe } from "./epub-generator.ts"

/**
 * 加载封面图片（可选）
 * 支持：绝对路径、相对于故事文件夹、相对于项目根目录
 * @param folderPath 故事文件夹路径
 * @param rootDir 项目根目录路径
 * @param coverPath config.json 中的 cover 字段值
 * @param locale 语言文案
 * @returns 封面图片；无封面或加载失败时返回 null
 */
export function loadCoverImage(
  folderPath: string,
  rootDir: string,
  coverPath: string,
  locale: Locale,
): EpubImage | null {
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
    console.warn(locale.epubCoverMissing(coverPath))
    return null
  }

  try {
    const data = new Uint8Array(fs.readFileSync(resolved))
    const ext = path.extname(resolved).toLowerCase()

    // SVG 安全检查：阻止含脚本/事件属性的 SVG 被嵌入 EPUB（XSS 防护）
    if (ext === ".svg") {
      const content = fs.readFileSync(resolved, "utf-8")
      if (!isSvgSafe(content)) {
        console.warn(locale.epubSvgUnsafe(coverPath))
        return null
      }
    }

    // 使用 cover 固定文件名（保留扩展名）
    return { name: `cover${ext}`, data }
  } catch (e) {
    console.warn(locale.epubCoverReadFailed(coverPath, (e as Error).message))
    return null
  }
}
