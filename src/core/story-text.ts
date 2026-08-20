/**
 * 故事正文读取与章节合并
 * 从 scanner.ts 拆分：负责 text.md / chapter-*.md 的读取与合并逻辑
 */

import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import { readTextFileChecked, readTextFileCheckedAsync, selectChapterFiles } from "./scanner.ts"

/**
 * 将章节文件内容合并为单一文本（纯函数，同步/异步版本共享）
 * 处理规则：
 *   - 跳过空内容（已存在但内容为空 的情况）
 *   - 提取章节标题（第一个 # 标题），若不存在则用文件名
 *   - 所有章节之间用 "---" 分隔
 * @param files 章节文件列表（文件名 + 内容）
 * @returns 合并后的正文文本
 */
export function mergeChapters(files: Array<{ name: string; content: string }>): string {
  const sections: string[] = []
  for (const { name, content } of files) {
    const raw = content.trim()
    // 跳过空内容
    if (!raw) continue
    // 提取章节标题（第一个 # 标题），若不存在则用文件名
    const titleMatch = raw.match(/^#\s+(.+)$/m)
    const title = titleMatch ? titleMatch[1] : name.replace(/\.md$/, "")
    sections.push(`# ${title}\n\n${raw.replace(/^#\s+.+$/m, "").trim()}`)
  }
  return sections.join("\n\n---\n\n")
}

/**
 * 共享：解析故事正文来源（纯逻辑，同步/异步版本共用）
 * 优先使用 text.md 内容；不存在时合并 chapter 文件内容
 * @param textContent text.md 的内容（不存在时为 null）
 * @param chapterFiles 章节文件列表（文件名 + 内容）
 * @returns 正文内容和是否合并生成
 */
function resolveStoryText(
  textContent: string | null,
  chapterFiles: Array<{ name: string; content: string }>,
): { content: string; merged: boolean } {
  // 已有 text.md 直接使用
  if (textContent !== null) {
    return { content: textContent, merged: false }
  }

  // 合并 chapter-*.md（跳过空内容）
  const nonEmptyFiles = chapterFiles.filter((f) => f.content.trim() !== "")
  if (nonEmptyFiles.length === 0) {
    return { content: "", merged: false }
  }

  return { content: mergeChapters(chapterFiles), merged: true }
}

/**
 * 同步读取故事正文（text.md 或合并 chapter-*.md）
 * @param folderPath 故事文件夹路径
 * @returns 正文内容和是否合并生成
 */
export function readStoryText(folderPath: string): { content: string; merged: boolean } {
  const textFile = path.join(folderPath, "text.md")

  // 已有 text.md 直接读取
  if (fs.existsSync(textFile)) {
    return { content: readTextFileChecked(textFile), merged: false }
  }

  // 合并 chapter-*.md
  let chapterNames: string[]
  try {
    chapterNames = selectChapterFiles(fs.readdirSync(folderPath))
  } catch {
    return { content: "", merged: false }
  }

  const files: Array<{ name: string; content: string }> = []
  for (const file of chapterNames) {
    try {
      files.push({ name: file, content: readTextFileChecked(path.join(folderPath, file)) })
    } catch {
      // 单个文件读取失败时跳过（与异步版本行为一致，避免一个坏文件拖垮整个故事）
    }
  }

  return resolveStoryText(null, files)
}

/**
 * 异步读取故事正文（text.md 或合并 chapter-*.md）
 * 与 readStoryText 行为一致，但使用 fs/promises 避免阻塞事件循环
 * @param folderPath 故事文件夹路径
 * @returns 正文内容和是否合并生成
 */
export async function readStoryTextAsync(folderPath: string): Promise<{ content: string; merged: boolean }> {
  const textFile = path.join(folderPath, "text.md")

  // 已有 text.md 直接读取
  try {
    return { content: await readTextFileCheckedAsync(textFile), merged: false }
  } catch {
    // text.md 不存在，继续尝试合并
  }

  // 合并 chapter-*.md
  let chapterNames: string[]
  try {
    chapterNames = selectChapterFiles(await fsp.readdir(folderPath))
  } catch {
    return { content: "", merged: false }
  }

  // 并行读取所有章节文件（避免逐个顺序 await 串行 IO）
  const fileResults = await Promise.all(
    chapterNames.map(async (file) => {
      try {
        return { name: file, content: await readTextFileCheckedAsync(path.join(folderPath, file)) }
      } catch {
        // 单个文件读取失败时跳过（不阻断整体合并）
        return null
      }
    }),
  )
  const files = fileResults.filter((f): f is { name: string; content: string } => f !== null)

  return resolveStoryText(null, files)
}
